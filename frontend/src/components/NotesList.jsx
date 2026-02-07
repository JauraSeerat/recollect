import React from 'react';
import { 
  Calendar, 
  Edit2, 
  Trash2, 
  FileText,
  Tag,
  Image
} from 'lucide-react';
import { format } from 'date-fns';
import './NotesList.css';

const NotesList = ({ notes, onEdit, onDelete }) => {
  if (!notes || notes.length === 0) {
    return (
      <div className="empty-state">
        <FileText size={64} />
        <h3>No notes yet</h3>
        <p>Start creating your first note!</p>
      </div>
    );
  }

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const stripHtml = (html) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const getPreview = (content, maxLength = 200) => {
    // Remove base64 images from preview
    let cleanContent = content.replace(/<img[^>]*>/g, '[Image]');
    
    // Strip HTML tags
    const text = stripHtml(cleanContent);
    
    // Trim and add ellipsis
    return text.length > maxLength 
      ? text.substring(0, maxLength) + '...'
      : text;
  };

  return (
    <div className="notes-list">
      {notes.map((note, index) => (
        <div key={note.id} className="note-card">
          <div className="note-header">
            <div className="note-meta">
              <span className="note-number">#{index + 1}</span>
              <span className="note-date">
                <Calendar size={14} />
                {formatDate(note.entry_date)}
              </span>
            </div>
            <div className="note-actions">
              <button
                className="btn-action btn-edit"
                onClick={() => onEdit?.(note)}
                title="Edit note"
              >
                <Edit2 size={16} />
              </button>
              <button
                className="btn-action btn-delete"
                onClick={() => onDelete?.(note)}
                title="Delete note"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {note.title && (
            <h3 className="note-title">{note.title}</h3>
          )}

          <div className="note-content">
            {getPreview(note.content)}
          </div>

          <div className="note-footer">
            {note.subject && note.subject !== 'General' && (
              <span className="note-subject">
                <Tag size={14} />
                {note.subject}
              </span>
            )}
            {note.media_count > 0 && (
              <span className="note-media">
                <Image size={14} />
                {note.media_count} image{note.media_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotesList;