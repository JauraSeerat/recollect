import React from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Tag, 
  Settings, 
  LogOut,
  FileText,
  BarChart3
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ 
  user, 
  stats, 
  activeView, 
  setActiveView, 
  onLogout 
}) => {
  const maskEmail = (email) => {
    if (!email || !email.includes('@')) return 'Signed in';
    const [localPart, domain] = email.split('@');
    const safeLocal = localPart.length <= 2
      ? `${localPart[0] || ''}***`
      : `${localPart.slice(0, 2)}***`;
    return `${safeLocal}@${domain}`;
  };

  const userLabel = user?.email ? maskEmail(user.email) : 'Signed in';

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <BookOpen size={32} />
        <h2>Recollect</h2>
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">
          {userLabel.charAt(0).toUpperCase()}
        </div>
        <div className="user-info">
          <h3>{userLabel}</h3>
          <p>{stats?.total_entries || 0} notes</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${activeView === 'all' ? 'active' : ''}`}
          onClick={() => setActiveView('all')}
        >
          <FileText size={20} />
          <span>All Notes</span>
          {stats?.total_entries > 0 && (
            <span className="badge">{stats.total_entries}</span>
          )}
        </button>

        <button
          className={`nav-item ${activeView === 'new' ? 'active' : ''}`}
          onClick={() => setActiveView('new')}
        >
          <Plus size={20} />
          <span>New Note</span>
        </button>

        <button
          className={`nav-item ${activeView === 'search' ? 'active' : ''}`}
          onClick={() => setActiveView('search')}
        >
          <Search size={20} />
          <span>Search</span>
        </button>

        <button
          className={`nav-item ${activeView === 'subjects' ? 'active' : ''}`}
          onClick={() => setActiveView('subjects')}
        >
          <Tag size={20} />
          <span>Subjects</span>
        </button>

        <button
          className={`nav-item ${activeView === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveView('stats')}
        >
          <BarChart3 size={20} />
          <span>Statistics</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={onLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
