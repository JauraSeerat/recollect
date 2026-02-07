import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
// import './App.css';

function App() {
  const [user, setUser] = useState(null);

  // Load saved user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error loading saved user:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Handle login
  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <div className="app">
      <Toaster position="top-right" />
      
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;