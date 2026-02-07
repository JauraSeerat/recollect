import CryptoJS from 'crypto-js';

/**
 * Encryption Service - Client-Side Encryption
 * 
 * All data is encrypted in the browser BEFORE sending to server.
 * Server stores encrypted data and cannot read it.
 * Only the user with the password can decrypt.
 */

class EncryptionService {
  constructor() {
    this.userPassword = null;
    this.isEnabled = false;
  }

  /**
   * Check if encryption is enabled for this user
   */
  isEncryptionEnabled() {
    return localStorage.getItem('encryption_enabled') === 'true';
  }

  /**
   * Enable encryption and set password
   */
  enableEncryption(password) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    this.userPassword = password;
    this.isEnabled = true;

    // Store password hash for verification (NOT the password itself)
    const hash = CryptoJS.SHA256(password).toString();
    localStorage.setItem('pwd_hash', hash);
    localStorage.setItem('encryption_enabled', 'true');
    
    return true;
  }

  /**
   * Disable encryption
   */
  disableEncryption() {
    this.userPassword = null;
    this.isEnabled = false;
    localStorage.removeItem('pwd_hash');
    localStorage.removeItem('encryption_enabled');
  }

  /**
   * Set password for current session
   */
  setPassword(password) {
    if (!this.isEncryptionEnabled()) {
      throw new Error('Encryption not enabled');
    }

    if (!this.verifyPassword(password)) {
      throw new Error('Incorrect password');
    }

    this.userPassword = password;
    return true;
  }

  /**
   * Verify password against stored hash
   */
  verifyPassword(password) {
    const hash = CryptoJS.SHA256(password).toString();
    const storedHash = localStorage.getItem('pwd_hash');
    return hash === storedHash;
  }

  /**
   * Check if password is set for current session
   */
  isPasswordSet() {
    return this.userPassword !== null;
  }

  /**
   * Encrypt text data
   */
  encrypt(text) {
    if (!this.isEnabled) {
      return text; // No encryption if not enabled
    }

    if (!this.userPassword) {
      throw new Error('Password not set. Please unlock your notes first.');
    }

    try {
      const encrypted = CryptoJS.AES.encrypt(text, this.userPassword).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt text data
   */
  decrypt(encryptedText) {
    if (!this.isEnabled) {
      return encryptedText; // No decryption if not enabled
    }

    if (!this.userPassword) {
      throw new Error('Password not set. Please unlock your notes first.');
    }

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, this.userPassword);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        throw new Error('Decryption failed - wrong password?');
      }
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data - wrong password?');
    }
  }

  /**
   * Encrypt multiple fields in an object
   */
  encryptObject(obj, fieldsToEncrypt = ['content', 'title']) {
    if (!this.isEnabled) {
      return obj;
    }

    const encrypted = { ...obj };
    
    fieldsToEncrypt.forEach(field => {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    });

    return encrypted;
  }

  /**
   * Decrypt multiple fields in an object
   */
  decryptObject(obj, fieldsToDecrypt = ['content', 'title']) {
    if (!this.isEnabled) {
      return obj;
    }

    const decrypted = { ...obj };
    
    fieldsToDecrypt.forEach(field => {
      if (decrypted[field]) {
        try {
          decrypted[field] = this.decrypt(decrypted[field]);
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          decrypted[field] = '[Encrypted - Cannot Decrypt]';
        }
      }
    });

    return decrypted;
  }

  /**
   * Encrypt image data (base64)
   */
  encryptImage(base64Data) {
    return this.encrypt(base64Data);
  }

  /**
   * Decrypt image data (base64)
   */
  decryptImage(encryptedData) {
    return this.decrypt(encryptedData);
  }

  /**
   * Change password
   */
  changePassword(oldPassword, newPassword) {
    if (!this.verifyPassword(oldPassword)) {
      throw new Error('Current password is incorrect');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    // Update stored hash
    const newHash = CryptoJS.SHA256(newPassword).toString();
    localStorage.setItem('pwd_hash', newHash);
    
    // Update current password
    this.userPassword = newPassword;

    return true;
  }

  /**
   * Clear password from memory (logout)
   */
  lockNotes() {
    this.userPassword = null;
  }

  /**
   * Get encryption status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      unlocked: this.isPasswordSet(),
      hasStoredHash: !!localStorage.getItem('pwd_hash')
    };
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

export default encryptionService;