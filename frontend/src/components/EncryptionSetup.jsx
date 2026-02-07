import React, { useState } from 'react';
import { Lock, Shield, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import encryption from '../services/encryption';
import './EncryptionSetup.css';

const EncryptionSetup = ({ onComplete, onSkip }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleEnable = () => {
    // Validation
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!agreed) {
      toast.error('Please confirm you understand the warning');
      return;
    }

    try {
      encryption.enableEncryption(password);
      toast.success('🔒 Encryption enabled! Your notes are now secure.');
      onComplete?.();
    } catch (error) {
      toast.error(error.message || 'Failed to enable encryption');
    }
  };

  return (
    <div className="encryption-setup">
      <div className="encryption-setup-content">
        <div className="encryption-header">
          <Shield size={48} className="shield-icon" />
          <h2>Enable End-to-End Encryption</h2>
          <p>Protect your notes with client-side encryption</p>
        </div>

        <div className="encryption-benefits">
          <h3>Why enable encryption?</h3>
          <ul>
            <li>
              <CheckCircle size={20} className="benefit-icon" />
              <div>
                <strong>Zero-Knowledge Security</strong>
                <p>Your data is encrypted BEFORE it reaches the server</p>
              </div>
            </li>
            <li>
              <CheckCircle size={20} className="benefit-icon" />
              <div>
                <strong>Complete Privacy</strong>
                <p>Even the server admin cannot read your notes</p>
              </div>
            </li>
            <li>
              <CheckCircle size={20} className="benefit-icon" />
              <div>
                <strong>Secure Storage</strong>
                <p>All content, titles, and images are encrypted</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="encryption-form">
          <div className="form-group">
            <label>
              <Lock size={16} />
              Create Encryption Password
            </label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password (min 8 characters)"
                minLength={8}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="password-strength">
              {password.length > 0 && (
                <div className={`strength-bar ${
                  password.length < 8 ? 'weak' : 
                  password.length < 12 ? 'medium' : 'strong'
                }`}>
                  <div className="strength-fill" style={{
                    width: `${Math.min((password.length / 16) * 100, 100)}%`
                  }}></div>
                </div>
              )}
              {password.length > 0 && password.length < 8 && (
                <small className="strength-text weak">Too short</small>
              )}
              {password.length >= 8 && password.length < 12 && (
                <small className="strength-text medium">Medium strength</small>
              )}
              {password.length >= 12 && (
                <small className="strength-text strong">Strong password</small>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>
              <Lock size={16} />
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              minLength={8}
            />
            {confirmPassword && password !== confirmPassword && (
              <small className="error-text">Passwords do not match</small>
            )}
          </div>
        </div>

        <div className="encryption-warning">
          <AlertTriangle size={24} className="warning-icon" />
          <div className="warning-content">
            <h4>⚠️ IMPORTANT WARNING</h4>
            <p>
              <strong>If you forget your password, your data is LOST FOREVER.</strong>
            </p>
            <p>
              There is NO password recovery. We cannot reset your password or decrypt your data.
              Make sure to:
            </p>
            <ul>
              <li>Choose a password you will remember</li>
              <li>Store it securely (password manager recommended)</li>
              <li>Never share it with anyone</li>
            </ul>
          </div>
        </div>

        <div className="encryption-agreement">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              I understand that if I forget my password, my encrypted data cannot be recovered
            </span>
          </label>
        </div>

        <div className="encryption-actions">
          <button 
            className="btn-secondary" 
            onClick={onSkip}
          >
            Skip for Now
          </button>
          <button
            className="btn-primary"
            onClick={handleEnable}
            disabled={
              password.length < 8 || 
              password !== confirmPassword || 
              !agreed
            }
          >
            <Shield size={18} />
            Enable Encryption
          </button>
        </div>

        <div className="encryption-footer">
          <p>
            <small>
              You can enable or disable encryption anytime in Settings.
              Encryption uses AES-256 encryption standard.
            </small>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EncryptionSetup;