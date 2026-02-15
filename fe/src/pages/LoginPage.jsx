import { useState } from 'react';
import { ArrowRight, Building2, LockKeyhole, Mail } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../api/client';
import loginLogo from '../assets/login_logo.png';

function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
      const nextPath = location.state?.from?.pathname || '/';
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-layout">
        <aside className="login-visual">
          {import.meta.env.VITE_LOGIN_IMAGE_URL ? (
            <img src={import.meta.env.VITE_LOGIN_IMAGE_URL} alt="Amplus visual" />
          ) : (
            <div className="login-visual-placeholder">
              <img src={loginLogo} alt="Amplus logo" className="h-14 w-auto max-w-full object-contain" />
              <p>Secure CRM workspace for subsidy delivery lifecycle.</p>
            </div>
          )}
        </aside>

        <div className="login-panel">
          <div className="login-brand">
            <div className="brand-pill">
              <Building2 size={14} />
              Amplus Subsidy Solutions
            </div>
            <h1>
              <img src={loginLogo} alt="Amplus logo" className="h-12 w-auto max-w-full object-contain" />
            </h1>
            <p>Enterprise Lead and Client Lifecycle Platform</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              Email
              <div className="input-icon-wrap">
                <Mail size={14} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </label>
            <label>
              Password
              <div className="input-icon-wrap">
                <LockKeyhole size={14} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </div>
            </label>
            {error ? <p className="error-text">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
              <ArrowRight size={14} />
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

export default LoginPage;
