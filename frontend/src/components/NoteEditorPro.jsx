import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { 
  Save, 
  Upload, 
  Loader, 
  X, 
  Camera,
  FileText,
  Calendar,
  Tag,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { entryAPI, uploadAPI } from '../services/api';
import './NoteEditorPro.css';

const NoteEditorPro = ({ user, entry, onSave, onCancel }) => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('General');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [savedImages, setSavedImages] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const quillRef = useRef(null);

  useEffect(() => {
    if (entry) {
      setContent(entry.content || '');
      setTitle(entry.title || '');
      setSubject(entry.subject || 'General');
      setEntryDate(entry.entry_date || new Date().toISOString().split('T')[0]);
      
      if (entry.media_paths && entry.media_paths.length > 0) {
        setSavedImages(entry.media_paths);
      }
    }
  }, [entry]);

  // Memoize modules to prevent re-initialization
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    clipboard: {
      matchVisual: false,
    }
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'align',
    'list', 'bullet', 'check',
    'indent',
    'blockquote', 'code-block',
    'link', 'image', 'video'
  ];

  // Custom image handler for embedding images in content
  function imageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (quillRef.current) {
            const quill = quillRef.current.getEditor();
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', e.target.result);
            quill.setSelection(range.index + 1);
          }
        };
        reader.readAsDataURL(file);
      }
    };
  }

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 10) {
      toast.error('Maximum 10 images allowed');
      return;
    }

    setImages(prev => [...prev, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, {
          url: reader.result,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtractFromMultiple = async () => {
    if (images.length === 0) {
      toast.error('Please upload images first');
      return;
    }

    setExtracting(true);
    const extractedTexts = [];

    try {
      for (const [index, image] of images.entries()) {
        toast.loading(`Processing image ${index + 1}/${images.length}...`, {
          id: 'ocr-progress'
        });
        
        try {
          const response = await uploadAPI.extractText(image);
          if (response.extracted_text) {
            extractedTexts.push(`\n\n📷 From ${image.name}:\n${response.extracted_text}`);
          }
        } catch (error) {
          console.error(`Failed to extract from ${image.name}:`, error);
        }
      }

      if (extractedTexts.length > 0) {
        const combinedText = extractedTexts.join('\n');
        setContent(prev => prev ? `${prev}${combinedText}` : combinedText);
        toast.success(`Extracted text from ${extractedTexts.length} image(s)!`, {
          id: 'ocr-progress'
        });
      } else {
        toast.error('No text found in any images', {
          id: 'ocr-progress'
        });
      }
    } catch (error) {
      toast.error('OCR failed', {
        id: 'ocr-progress'
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim() || content === '<p><br></p>') {
      toast.error('Please enter some content');
      return;
    }

    setSaving(true);
    try {
      // Upload images first
      const imagePaths = [];
      for (const image of images) {
        try {
          const uploadResult = await uploadAPI.uploadImage(image, user.user_id);
          imagePaths.push(uploadResult.file_path);
        } catch (error) {
          console.error('Failed to upload image:', error);
        }
      }

      const entryData = {
        user_id: user.user_id,
        content: content.trim(),
        title: title.trim() || null,
        subject: subject || 'General',
        entry_date: entryDate,
        image_paths: imagePaths.length > 0 ? imagePaths : null,
      };

      if (entry?.id) {
        await entryAPI.updateEntry(entry.id, {
          content: entryData.content,
          title: entryData.title,
          subject: entryData.subject,
        });
        toast.success('Note updated successfully!');
      } else {
        await entryAPI.createEntry(entryData);
        toast.success('Note saved successfully!');
      }

      // Reset form
      setContent('');
      setTitle('');
      setSubject('General');
      setEntryDate(new Date().toISOString().split('T')[0]);
      setImages([]);
      setImagePreviews([]);
      setSavedImages([]);
      
      onSave?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="note-editor-pro">
      <div className="editor-header">
        <h2>{entry ? 'Edit Note' : 'New Note'}</h2>
        {onCancel && (
          <button className="btn-icon" onClick={onCancel}>
            <X size={20} />
          </button>
        )}
      </div>

      <div className="editor-form">
        <div className="form-row">
          <div className="form-group flex-1">
            <label>
              <FileText size={16} />
              Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter note title..."
            />
          </div>

          <div className="form-group">
            <label>
              <Calendar size={16} />
              Date
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>
            <Tag size={16} />
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Work, Personal, Study..."
          />
        </div>

        {/* Image Upload Section */}
        <div className="image-upload-section">
          <div className="upload-controls">
            <label className="upload-label">
              <Camera size={20} />
              Upload Images
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImagesChange}
                style={{ display: 'none' }}
              />
            </label>

            {images.length > 0 && (
              <button
                className="btn-extract"
                onClick={handleExtractFromMultiple}
                disabled={extracting}
              >
                {extracting ? (
                  <>
                    <Loader className="spin" size={18} />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Extract Text ({images.length})
                  </>
                )}
              </button>
            )}
          </div>

          {imagePreviews.length > 0 && (
            <div className="image-previews-grid">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="image-preview-item">
                  <img src={preview.url} alt={preview.name} />
                  <button 
                    className="btn-remove-small" 
                    onClick={() => handleRemoveImage(index)}
                  >
                    <X size={14} />
                  </button>
                  <span className="image-name">{preview.name}</span>
                </div>
              ))}
            </div>
          )}

          {savedImages.length > 0 && (
            <div className="saved-images">
              <h4>📎 Attached Images:</h4>
              <div className="image-previews-grid">
                {savedImages.map((path, index) => (
                  <div key={index} className="image-preview-item">
                    <img src={path} alt="Saved" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rich Text Editor */}
        <div className="form-group">
          <label>
            <FileText size={16} />
            Content
          </label>
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            placeholder="Write your note here... Use the toolbar to format text, add links, images, tables, and more!"
            className="quill-editor"
          />
        </div>

        <div className="editor-actions">
          {onCancel && (
            <button className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !content.trim() || content === '<p><br></p>'}
          >
            {saving ? (
              <>
                <Loader className="spin" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                {entry ? 'Update Note' : 'Save Note'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteEditorPro;
