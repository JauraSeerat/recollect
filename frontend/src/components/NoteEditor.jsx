import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Upload, 
  Loader, 
  X, 
  Camera,
  FileText,
  Calendar,
  Tag
} from 'lucide-react';
import toast from 'react-hot-toast';
import { entryAPI, uploadAPI } from '../services/api';
import './NoteEditor.css';

const NoteEditor = ({ user, entry, onSave, onCancel }) => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('General');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setContent(entry.content || '');
      setTitle(entry.title || '');
      setSubject(entry.subject || 'General');
      setEntryDate(entry.entry_date || new Date().toISOString().split('T')[0]);
    }
  }, [entry]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExtractText = async () => {
    if (!image) {
      toast.error('Please upload an image first');
      return;
    }

    setExtracting(true);
    try {
      const response = await uploadAPI.extractText(image);
      if (response.extracted_text) {
        setContent(response.extracted_text);
        toast.success('Text extracted successfully!');
      } else {
        toast.error('No text found in image');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'OCR failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Please enter some content');
      return;
    }

    setSaving(true);
    try {
      const entryData = {
        user_id: user.user_id,
        content: content.trim(),
        title: title.trim() || null,
        subject: subject || 'General',
        entry_date: entryDate,
      };

      if (entry?.id) {
        // Update existing entry
        await entryAPI.updateEntry(entry.id, {
          content: entryData.content,
          title: entryData.title,
          subject: entryData.subject,
        });
        toast.success('Note updated successfully!');
      } else {
        // Create new entry
        await entryAPI.createEntry(entryData);
        toast.success('Note saved successfully!');
      }

      // Reset form
      setContent('');
      setTitle('');
      setSubject('General');
      setEntryDate(new Date().toISOString().split('T')[0]);
      setImage(null);
      setImagePreview(null);
      
      onSave?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleClearImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  return (
    <div className="note-editor">
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

        <div className="image-upload-section">
          <label className="upload-label">
            <Camera size={20} />
            Upload Image
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </label>

          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" />
              <button className="btn-remove" onClick={handleClearImage}>
                <X size={16} />
              </button>
            </div>
          )}

          {image && !entry && (
            <button
              className="btn-extract"
              onClick={handleExtractText}
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
                  Extract Text from Image
                </>
              )}
            </button>
          )}
        </div>

        <div className="form-group">
          <label>Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note here or extract text from an image..."
            rows={12}
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

export default NoteEditor;