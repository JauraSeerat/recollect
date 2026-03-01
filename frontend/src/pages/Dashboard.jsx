import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, FileText, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
// import NoteEditor from '../components/NoteEditor';
import NotesList from '../components/NotesList';
import { entryAPI, userAPI } from '../services/api';
import './Dashboard.css';
// // Change this import
// import NoteEditor from '../components/NoteEditor';

// To this
import NoteEditorPro from '../components/NoteEditorPro';

const Dashboard = ({ user, onLogout }) => {
  const [activeView, setActiveView] = useState('all');
  const [notes, setNotes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    loadNotes();
    loadStats();
    loadSubjects();
  }, [user]);

  const handleViewChange = (nextView) => {
    setActiveView(nextView);
    if (nextView === 'all') {
      setEditingNote(null);
      setSearchQuery('');
      loadNotes();
    }
  };

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await entryAPI.getUserEntries(user.user_id);
      setNotes(data);
    } catch (error) {
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await userAPI.getUserStats(user.user_id);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats');
    }
  };

  const loadSubjects = async () => {
    try {
      const data = await entryAPI.getSubjects(user.user_id);
      setSubjects(data);
    } catch (error) {
      console.error('Failed to load subjects');
    }
  };

  const handleSave = () => {
    loadNotes();
    loadStats();
    loadSubjects();
    setActiveView('all');
    setEditingNote(null);
  };

  const handleEdit = (note) => {
    setEditingNote(note);
    setActiveView('edit');
  };

  const handleDelete = async (note) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      await entryAPI.deleteEntry(note.id);
      toast.success('Note deleted successfully!');
      loadNotes();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadNotes();
      return;
    }

    try {
      const data = await entryAPI.searchEntries(user.user_id, searchQuery);
      setNotes(data);
    } catch (error) {
      toast.error('Search failed');
    }
  };

  const filteredNotes = notes;

  return (
    <div className="dashboard">
      <Sidebar
        user={user}
        stats={stats}
        activeView={activeView}
        setActiveView={handleViewChange}
        onLogout={onLogout}
      />

      <main className="dashboard-main">
        <div className="dashboard-content">
          {activeView === 'all' && (
            <>
              <div className="content-header">
                <h1>All Notes</h1>
                <div className="header-actions">
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      type="text"
                      placeholder="Search notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="loading-state">
                  <div className="spinner-large"></div>
                  <p>Loading notes...</p>
                </div>
              ) : (
                <NotesList
                  notes={filteredNotes}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )}
            </>
          )}

          {activeView === 'new' && (
            <NoteEditorPro user={user} onSave={handleSave} />
          )}

          {activeView === 'edit' && (
            <NoteEditorPro
            user={user}
            entry={editingNote}
            onSave={handleSave}
            onCancel={() => {
              setEditingNote(null);
              handleViewChange('all');
            }}
          />
          )}

          {activeView === 'search' && (
            <>
              <div className="content-header">
                <h1>Search Notes</h1>
              </div>
              <div className="search-page">
                <div className="search-box-large">
                  <Search size={24} />
                  <input
                    type="text"
                    placeholder="Search your notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    autoFocus
                  />
                  <button onClick={handleSearch}>Search</button>
                </div>
                <NotesList
                  notes={filteredNotes}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </div>
            </>
          )}

          {activeView === 'subjects' && (
            <>
              <div className="content-header">
                <h1>Subjects</h1>
              </div>
              <div className="subjects-grid">
                {subjects.length > 0 ? (
                  subjects.map((subject) => (
                    <div key={subject} className="subject-card">
                      <h3>{subject}</h3>
                      <button
                        onClick={async () => {
                          const data = await entryAPI.getEntriesBySubject(
                            user.user_id,
                            subject
                          );
                          setNotes(data);
                          setActiveView('all');
                        }}
                      >
                        View Notes
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>No subjects yet. Add subjects to your notes!</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeView === 'stats' && (
            <>
              <div className="content-header">
                <h1>Statistics</h1>
              </div>
              {stats && (
                <div className="stats-grid">
                  <div className="stat-card">
                    <FileText size={32} />
                    <h3>{stats.total_entries || 0}</h3>
                    <p>Total Notes</p>
                  </div>
                  <div className="stat-card">
                    <Calendar size={32} />
                    <h3>{stats.unique_days || 0}</h3>
                    <p>Days Logged</p>
                  </div>
                  <div className="stat-card">
                    <TrendingUp size={32} />
                    <h3>{stats.total_characters || 0}</h3>
                    <p>Total Characters</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
