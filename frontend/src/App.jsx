import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import LandingPage from './components/LandingPage'; 
import Dashboard from './pages/Dashboard';
// import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);  // ← ADD THIS

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

   // Handle "Get Started" from landing page
  const handleGetStarted = () => {  // ← ADD THIS
    setShowAuth(true);
  };

  // Handle login
  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    setShowAuth(false);  // ← ADD THIS LINE
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');  // ← ADD THIS LINE
    setShowAuth(false);  // ← ADD THIS LINE
  };

    return (
    <div className="app">
      <Toaster position="top-right" />
      
      {/* If user is logged in, show Dashboard */}
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : showAuth ? (
        /* If showing auth, show Login/Signup */
        <Login onLogin={handleLogin} />
      ) : (
        /* Otherwise show Landing Page */
        <LandingPage onGetStarted={handleGetStarted} />
      )}
    </div>
  );
}

export default App;