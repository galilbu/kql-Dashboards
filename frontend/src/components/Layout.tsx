import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          height: '56px',
          backgroundColor: '#1a1a2e',
          color: '#fff',
          borderBottom: '1px solid #333',
        }}
      >
        <Link
          to="/dashboards"
          style={{ color: '#fff', textDecoration: 'none', fontSize: '1.2rem', fontWeight: 600 }}
        >
          KQL Dashboard
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user && <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>{user.name}</span>}
          <button
            onClick={() => logout()}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '4px',
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main style={{ flex: 1, overflow: 'auto', backgroundColor: '#0f0f1a' }}>{children}</main>
    </div>
  );
}
