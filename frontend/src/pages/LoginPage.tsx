import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalAuth } from '../auth/useLocalAuth';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

function EtoroLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="90" height="28" fill="none" viewBox="0 0 102 32">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#13C636"
        d="M9.797 10.8c.257-.231.396-.405.189-.405-.435 0-3.065.388-3.607-1.598S8.737.817 8.846.56C8.95.313 8.734 0 8.416 0c-.313 0-.543.34-.576.38C4.881 4.093.75 8.727.218 10.725c-1.347 5.058 3.859 7.108 7.145 7.483a.076.076 0 0 0 .087-.075v-1.796c0-2.424.907-4.24 2.347-5.536M92.032 10.8c-.257-.231-.396-.405-.188-.405.434 0 3.064.388 3.606-1.598S93.093.817 92.983.56c-.105-.247.112-.56.43-.56.313 0 .543.34.576.38 2.959 3.712 7.09 8.346 7.622 10.344 1.347 5.058-3.859 7.108-7.145 7.483a.076.076 0 0 1-.087-.075v-1.796c0-2.424-.907-4.24-2.347-5.536M88.574 23.713c0 1.961-2.623 3.082-4.33 3.082-1.826 0-4.41-1.12-4.41-3.082V16.8c0-1.96 2.584-2.88 4.41-2.88 1.707 0 4.33.92 4.33 2.88zm-4.33-14.076c-4.05.04-8.776 2.401-8.776 7.163v7.244c0 4.843 4.727 7.124 8.776 7.164 3.97-.04 8.697-2.321 8.697-7.164V16.8c0-4.762-4.727-7.123-8.697-7.163M58.063 23.713c0 1.961-2.623 3.082-4.33 3.082-1.825 0-4.409-1.12-4.409-3.082V16.8c0-1.96 2.584-2.88 4.409-2.88 1.707 0 4.33.92 4.33 2.88zm-4.33-14.076c-4.049.04-8.775 2.401-8.775 7.163v7.244c0 4.843 4.726 7.124 8.775 7.164 3.97-.04 8.697-2.321 8.697-7.164V16.8c0-4.762-4.727-7.123-8.697-7.163M44.63 11.214c-3.232-.882-5.621-1.251-9.085-1.252-3.465 0-5.861.37-9.087 1.248a.18.18 0 0 0-.113.288c1.105.92 1.568 2.15 1.783 3.538a27.6 27.6 0 0 1 5.233-.793v16.823c-.001.06.042.097.105.097h4.155q.108.008.106-.093V14.246c1.789.106 3.28.359 5.041.79.268-1.38.828-2.667 1.959-3.528.1-.126.014-.264-.096-.294M75.627 9.785c-.31-.044-1.228-.177-2.035-.147-3.977.154-8.475 2.52-8.475 7.162v14.311c-.002.06.041.096.105.096h4.155q.108.009.106-.093V16.8c0-1.53 1.87-2.477 3.43-2.796.453-1.526 1.344-2.627 2.708-3.731.239-.194.226-.457.006-.488M21.766 18.022a.184.184 0 0 1-.183.185h-7.964V16.75c0-1.99 2.345-2.923 4.197-2.923 1.731 0 3.951.934 3.951 2.923zm-3.95-8.54c-4.107.042-8.626 2.436-8.626 7.267v7.347c0 4.911 4.52 7.226 8.626 7.266 2.942-.03 6.292-1.256 7.887-3.858.053-.086.006-.2-.075-.248-1.406-.812-2.222-1.262-3.615-2.053-.044-.025-.091-.025-.127.035-.761 1.278-2.704 1.984-4.07 1.984-1.852 0-4.197-1.137-4.197-3.126V21.9h11.384c.608 0 1.101-.497 1.101-1.11v-4.042c0-4.83-4.262-7.225-8.288-7.266"
      />
    </svg>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginLocal } = useLocalAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginLocal(email, password);
      navigate('/dashboards', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.88rem',
    fontFamily: 'var(--font-body)',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface-0)',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          animation: 'fadeIn 0.35s ease both',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <EtoroLogo />
          <p
            style={{
              color: 'var(--text-tertiary)',
              fontSize: '0.8rem',
              marginTop: '0.75rem',
              letterSpacing: '0.02em',
            }}
          >
            SOC Portal
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
          }}
        >
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Sign in</h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '0.85rem' }}>
              <label
                style={{
                  display: 'block',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: '0.35rem',
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--green-border)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label
                style={{
                  display: 'block',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: '0.35rem',
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--green-border)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && (
              <div
                style={{
                  color: 'var(--error)',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                  padding: '0.5rem 0.7rem',
                  backgroundColor: 'rgba(240, 72, 72, 0.06)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.65rem',
                backgroundColor: loading ? 'var(--surface-4)' : 'var(--green)',
                color: loading ? 'var(--text-tertiary)' : 'var(--text-inverse)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.88rem',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                transition: 'background-color 0.15s ease',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.82rem' }}>
            <button
              onClick={() => navigate('/register?token=')}
              style={{
                color: 'var(--green)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '0.82rem',
              }}
            >
              Don't have an account? Register
            </button>
          </p>

          {/* Divider — only shown if Entra SSO env vars are set or dev mode */}
          {!DEV_MODE && (import.meta.env.VITE_CLIENT_ID || import.meta.env.VITE_TENANT_ID) && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  margin: '1.25rem 0',
                }}
              >
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>or</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
              </div>

              <button
                onClick={() => navigate('/sso-login')}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'border-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                Sign in with Microsoft
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
