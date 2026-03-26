import { useState } from 'react';
import { api } from '../api/client';

interface InviteResponse {
  token: string;
  expires_at: string;
}

export function InviteButton() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await api.post<InviteResponse>('/auth/invite', {});
      const url = `${window.location.origin}/register?token=${data.token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleGenerate}
        disabled={loading}
        title="Generate invite link"
        style={{
          padding: '0.3rem 0.7rem',
          fontSize: '0.75rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          backgroundColor: copied ? 'var(--green-bg)' : 'transparent',
          color: copied ? 'var(--green)' : 'var(--text-tertiary)',
          border: `1px solid ${copied ? 'var(--green-border)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-body)',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!copied) {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!copied) {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-tertiary)';
          }
        }}
      >
        {copied ? '✓ Link copied' : loading ? 'Generating...' : '+ Invite'}
      </button>
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            backgroundColor: 'var(--surface-3)',
            border: '1px solid rgba(240,72,72,0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.35rem 0.6rem',
            fontSize: '0.72rem',
            color: 'var(--error)',
            whiteSpace: 'nowrap',
            zIndex: 100,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
