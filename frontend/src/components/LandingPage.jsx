import { useState } from 'react';
import { BookOpen, Image, Search, Lock, Cloud, Zap } from 'lucide-react';
import './LandingPage.css';

function LandingPage({ onGetStarted }) {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <header className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            <BookOpen size={48} className="logo-icon" />
            Recollect
          </h1>
          <p className="hero-subtitle">
            Transform handwritten notes into searchable digital memories
          </p>
          <p className="hero-description">
            Capture, digitize, and organize your handwritten notes with AI-powered OCR. 
            Never lose an important thought again.
          </p>
          <button className="cta-button" onClick={onGetStarted}>
            Get Started Free →
          </button>
        </div>
      </header>

      {/* Features Section */}
      <section className="features">
        <h2 className="section-title">Why Recollect?</h2>
        <div className="features-grid">
          
          <div className="feature-card">
            <div className="feature-icon">
              <Image size={32} />
            </div>
            <h3>Smart OCR</h3>
            <p>Upload photos of handwritten notes and extract text instantly using AI-powered recognition</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Search size={32} />
            </div>
            <h3>Powerful Search</h3>
            <p>Find any note in seconds. Search across all your handwritten and typed content</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <BookOpen size={32} />
            </div>
            <h3>Rich Text Editor</h3>
            <p>Edit and format your notes with a beautiful, intuitive editor. Add images and styling</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Cloud size={32} />
            </div>
            <h3>Cloud Storage</h3>
            <p>Your notes are safely stored in the cloud. Access them anywhere, anytime</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Lock size={32} />
            </div>
            <h3>Secure & Private</h3>
            <p>Your notes are encrypted and protected. Only you can access your data</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Zap size={32} />
            </div>
            <h3>Fast & Simple</h3>
            <p>No complexity. Just upload, extract, organize. That's it.</p>
          </div>

        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        <div className="steps">
          
          <div className="step">
            <div className="step-number">1</div>
            <h3>Take a Photo</h3>
            <p>Snap a picture of your handwritten notes with your phone or camera</p>
          </div>

          <div className="step">
            <div className="step-number">2</div>
            <h3>Extract Text</h3>
            <p>Our AI instantly recognizes and extracts the text from your image</p>
          </div>

          <div className="step">
            <div className="step-number">3</div>
            <h3>Organize & Search</h3>
            <p>Tag notes by subject, search instantly, and access from anywhere</p>
          </div>

        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits">
        <h2 className="section-title">Why Students & Professionals Choose Recollect</h2>
        <div className="benefits-list">
          <div className="benefit">
            <span className="checkmark">✓</span>
            <p><strong>Never lose notes again</strong> - All your notes in one searchable place</p>
          </div>
          <div className="benefit">
            <span className="checkmark">✓</span>
            <p><strong>Study smarter</strong> - Search across semesters of notes instantly</p>
          </div>
          <div className="benefit">
            <span className="checkmark">✓</span>
            <p><strong>Save time</strong> - No more retyping handwritten notes</p>
          </div>
          <div className="benefit">
            <span className="checkmark">✓</span>
            <p><strong>Stay organized</strong> - Automatic categorization by subject</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="final-cta">
        <h2>Ready to digitize your notes?</h2>
        <p>Join students and professionals who trust Recollect</p>
        <button className="cta-button" onClick={onGetStarted}>
          Start Using Recollect →
        </button>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© 2026 Recollect. Built with ❤️ for better note-taking.</p>
      </footer>
    </div>
  );
}

export default LandingPage;