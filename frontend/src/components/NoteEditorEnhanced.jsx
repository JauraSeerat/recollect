import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  Upload, 
  Loader, 
  X, 
  Camera,
  FileText,
  Calendar,
  Tag,
  Image as ImageIcon,
  Bold,
  Italic,
  List,
  Table as TableIcon,
  Type
} from 'lucide-react';
import toast from 'react-hot-toast';
import { entryAPI, uploadAPI } from '../services/api';
import './NoteEditorEnhanced.css';

const NoteEditorEnhanced = ({ user, entry, onSave, onCancel }) => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('General');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [savedImages, setSavedImages] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (entry) {
      setContent(entry.content || '');
      setTitle(entry.title || '');
      setSubject(entry.subject || 'General');
      setEntryDate(entry.entry_date || new Date().toISOString().split('T')[0]);
      
      // Load existing images
      if (entry.media_paths && entry.media_paths.length > 0) {
        setSavedImages(entry.media_paths);
      }
    }
  }, [entry]);

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files]);
    
    // Generate previews
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
        toast.loading(`Processing image ${index + 1}/${images.length}...`);
        
        try {
          const response = await uploadAPI.extractText(image);
          if (response.extracted_text) {
            extractedTexts.push(`--- From ${image.name} ---\n${response.extracted_text}`);
          }
        } catch (error) {
          console.error(`Failed to extract from ${image.name}:`, error);
        }
      }

      if (extractedTexts.length > 0) {
        const combinedText = extractedTexts.join('\n\n');
        setContent(prev => prev ? `${prev}\n\n${combinedText}` : combinedText);
        toast.success(`Extracted text from ${extractedTexts.length} image(s)!`);
      } else {
        toast.error('No text found in any images');
      }
    } catch (error) {
      toast.error('OCR failed');
    } finally {
      setExtracting(false);
      toast.dismiss();
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Please enter some content');
      return;
    }

    setSaving(true);
    try {
      // Upload images first if any
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

  // Rich text formatting functions
  const formatText = (command, value = null) => {
    document.execCommand(command, false, value);
    contentRef.current?.focus();
  };

  const insertTable = () => {
    const rows = prompt('Number of rows:', '3');
    const cols = prompt('Number of columns:', '3');
    
    if (rows && cols) {
      let table = '<table border="1" style="border-collapse: collapse; width: 100%;">\n';
      for (let i = 0; i < parseInt(rows); i++) {
        table += '  <tr>\n';
        for (let j = 0; j < parseInt(cols); j++) {
          table += '    <td style="padding: 8px; border: 1px solid #ddd;"> </td>\n';
        }
        table += '  </tr>\n';
      }
      table += '</table><br>';
      
      document.execCommand('insertHTML', false, table);
    }
  };

  const insertBulletList = () => {
    formatText('insertUnorderedList');
  };

  const insertNumberedList = () => {
    formatText('insertOrderedList');
  };

  return (
    <div className="note-editor-enhanced">
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
          <label className="upload-label">
            <Camera size={20} />
            Upload Images (Multiple)
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagesChange}
              style={{ display: 'none' }}
            />
          </label>

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

          {/* Show saved images if editing */}
          {savedImages.length > 0 && (
            <div className="saved-images">
              <h4>Attached Images:</h4>
              <div className="image-previews-grid">
                {savedImages.map((path, index) => (
                  <div key={index} className="image-preview-item">
                    <img src={`/api/media/${entry.id}/${path.split('/').pop()}`} alt="Saved" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {images.length > 0 && !entry && (
            <button
              className="btn-extract"
              onClick={handleExtractFromMultiple}
              disabled={extracting}
            >
              {extracting ? (
                <>
                  <Loader className="spin" size={18} />
                  Extracting from {images.length} image(s)...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Extract Text from All Images
                </>
              )}
            </button>
          )}
        </div>

        {/* Rich Text Toolbar */}
        <div className="rich-text-toolbar">
          <button 
            type="button"
            onClick={() => formatText('bold')} 
            title="Bold (Ctrl+B)"
            className="toolbar-btn"
          >
            <Bold size={18} />
          </button>
          <button 
            type="button"
            onClick={() => formatText('italic')} 
            title="Italic (Ctrl+I)"
            className="toolbar-btn"
          >
            <Italic size={18} />
          </button>
          <button 
            type="button"
            onClick={() => formatText('underline')} 
            title="Underline (Ctrl+U)"
            className="toolbar-btn"
          >
            <Type size={18} />
          </button>
          
          <div className="toolbar-divider"></div>
          
          <select 
            onChange={(e) => formatText('fontSize', e.target.value)}
            className="toolbar-select"
            defaultValue="3"
          >
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="7">Huge</option>
          </select>
          
          <div className="toolbar-divider"></div>
          
          <button 
            type="button"
            onClick={insertBulletList} 
            title="Bullet List"
            className="toolbar-btn"
          >
            <List size={18} />
          </button>
          <button 
            type="button"
            onClick={insertNumberedList} 
            title="Numbered List"
            className="toolbar-btn"
          >
            <List size={18} style={{ fontWeight: 'bold' }} />
          </button>
          <button 
            type="button"
            onClick={insertTable} 
            title="Insert Table"
            className="toolbar-btn"
          >
            <TableIcon size={18} />
          </button>
        </div>

        {/* Content Editor */}
        <div className="form-group">
          <label>Content</label>
          <div
            ref={contentRef}
            className="rich-text-editor"
            contentEditable
            onInput={(e) => setContent(e.currentTarget.innerHTML)}
            dangerouslySetInnerHTML={{ __html: content }}
            data-placeholder="Write your note here or extract text from images..."
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
            disabled={saving || !content.trim()}
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

export default NoteEditorEnhanced;