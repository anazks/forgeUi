import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Flame, Loader2 } from 'lucide-react';
import { authApi } from '../services/api';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await authApi.login({ email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'AUTHENTICATION FAILED');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="bg-mesh"></div>
      
      <div className="glass-card login-card">
        <div className="login-header">
          <div className="sharp-logo-small" onClick={() => navigate('/')}>
            <Flame size={20} fill="white" />
          </div>
          <h2>SYSTEM ACCESS</h2>
          <p>RESTRICTED ENVIRONMENT</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="input-group">
            <label>IDENTIFIER (EMAIL)</label>
            <input 
              type="email" 
              className="input-field" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="input-group">
            <label>PROTOCOL (PASSWORD)</label>
            <div className="password-wrapper">
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="input-field" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
              <button 
                type="button" 
                className="eye-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : 'LOGIN'}
          </button>
        </form>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 24px; background: var(--bg-main);
        }
        .login-card { width: 100%; max-width: 360px; padding: 32px; border: 1px solid var(--border-main); }
        .login-header { text-align: center; margin-bottom: 32px; }
        .sharp-logo-small {
          width: 40px; height: 40px; background: var(--primary);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px; cursor: pointer;
        }
        .login-header h2 { font-size: 1.25rem; margin-bottom: 4px; }
        .login-header p { color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; }

        .password-wrapper { position: relative; display: flex; align-items: center; }
        .eye-btn { position: absolute; right: 12px; background: none; border: none; color: var(--text-dim); cursor: pointer; }
        
        .w-full { width: 100%; justify-content: center; padding: 10px; }
      `}</style>
    </div>
  );
};

export default LoginPage;
