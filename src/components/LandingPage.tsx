import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Flame, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="landing-container">
      <div className="bg-mesh"></div>
      
      <main className="landing-content">
        <div className="logo-wrapper">
          <div className="sharp-logo">
            <Flame size={24} fill="white" />
          </div>
          <span className="logo-text">FORGE PLATFORM</span>
        </div>

        <div className="hero-section">
          <h1 className="hero-title">ENTERPRISE CORE</h1>
          <p className="hero-subtitle">
            HIGH-PRECISION OPERATIONAL INFRASTRUCTURE FOR THE MODERN CORPORATION.
          </p>
          
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate('/login')}>
              INITIALIZE SYSTEM
              <ArrowRight size={18} />
            </button>
            <button className="theme-toggle-btn-landing" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              {theme === 'light' ? 'NIGHT' : 'DAY'}
            </button>
          </div>
        </div>
      </main>

      <style>{`
        .landing-container {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 40px; background: var(--bg-main);
        }
        .landing-content { max-width: 800px; text-align: center; }
        
        .logo-wrapper { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 32px; }
        .sharp-logo { background: var(--primary); padding: 8px; }
        .logo-text { font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 800; letter-spacing: 2px; color: var(--text-main); }
        
        .hero-title {
          font-size: 4rem; line-height: 1; font-weight: 800; margin-bottom: 24px;
          color: var(--text-main); letter-spacing: -0.02em;
        }
        .hero-subtitle { font-size: 1rem; color: var(--text-muted); max-width: 500px; margin: 0 auto 40px; font-weight: 700; letter-spacing: 1px; }
        
        .hero-actions { display: flex; justify-content: center; gap: 16px; }
        .theme-toggle-btn-landing {
          background: none; border: 1px solid var(--border-strong); color: var(--text-main);
          padding: 8px 24px; font-weight: 700; font-size: 0.8rem; cursor: pointer;
          display: flex; align-items: center; gap: 8px;
        }
        .theme-toggle-btn-landing:hover { background: var(--row-hover); }

        @media (max-width: 768px) { .hero-title { font-size: 2.5rem; } }
      `}</style>
    </div>
  );
};

export default LandingPage;
