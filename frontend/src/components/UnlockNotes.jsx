import React, { useState } from 'react';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import encryption from '../services/encryption';
import './UnlockNotes.css';

const UnlockNotes = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e) => {
    e.preventDefault();
    
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setLoading(true);
    
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));
      
      encryption.setPassword(password);
      toast.success('🔓 Notes unlocked!');
      onUnlock?.();
    } catch (error) {
      toast.error(error.message || 'Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="unlock-notes">
      <div className="unlock-content">
        <div className="unlock-icon">
          <Lock size={64} />
        </div>
        
        <h2>Your Notes Are Encrypted</h2>
        <p>Enter your password to unlock and view your notes</p>

        <form onSubmit={handleUnlock} className="unlock-form">
          <div className="password-input-group">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your encryption password"
              autoFocus
              disabled={loading}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button 
            type="submit" 
            className="btn-unlock"
            disabled={!password || loading}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Unlocking...
              </>
            ) : (
              <>
                <Unlock size={20} />
                Unlock Notes
              </>
            )}
          </button>
        </form>

        <div className="unlock-help">
          <p>
            <strong>Forgot your password?</strong>
          </p>
          <p>
            Unfortunately, encrypted data cannot be recovered without the password.
            This ensures maximum security for your notes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnlockNotes;