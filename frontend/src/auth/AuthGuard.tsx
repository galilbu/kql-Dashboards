import { ReactNode } from 'react';
import { useAuth } from './useAuth';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, login } = useAuth();

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '1rem',
      }}>
        <h1>KQL Dashboard</h1>
        <p>Sign in with your organization account to continue.</p>
        <button onClick={login} style={{
          padding: '0.75rem 2rem',
          fontSize: '1rem',
          cursor: 'pointer',
          backgroundColor: '#0078d4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
        }}>
          Sign in with Microsoft
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
