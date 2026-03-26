import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';
import type { Permission, UserSearchResult } from '../types';

interface ShareDialogProps {
  dashboardId: string;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.7rem',
  backgroundColor: 'var(--surface-1)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.82rem',
  fontFamily: 'var(--font-body)',
  outline: 'none',
  transition: 'border-color 0.15s ease',
};

export function ShareDialog({ dashboardId, onClose }: ShareDialogProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('viewer');
  const [loading, setLoading] = useState(true);
  const { getAccessToken } = useAuth();

  const fetchPermissions = useCallback(async () => {
    try {
      const token = await getAccessToken(['openid']);
      const data = await api.get<{ permissions: Permission[] }>(
        `/dashboards/${dashboardId}/permissions`,
        token,
      );
      setPermissions(data.permissions);
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [dashboardId, getAccessToken]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const searchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const token = await getAccessToken(['openid']);
      const data = await api.get<{ users: UserSearchResult[] }>(
        `/users/search?q=${encodeURIComponent(query)}`,
        token,
      );
      setSearchResults(data.users);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const grantAccess = async (userOid: string) => {
    try {
      const token = await getAccessToken(['openid']);
      await api.post(
        `/dashboards/${dashboardId}/permissions`,
        { user_oid: userOid, role: selectedRole },
        token,
      );
      setSearchQuery('');
      setSearchResults([]);
      fetchPermissions();
    } catch (err) {
      console.error('Failed to grant access:', err);
    }
  };

  const revokeAccess = async (userOid: string) => {
    try {
      const token = await getAccessToken(['openid']);
      await api.delete(`/dashboards/${dashboardId}/permissions/${userOid}`, token);
      fetchPermissions();
    } catch (err) {
      console.error('Failed to revoke access:', err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: 'var(--surface-2)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          padding: '1.5rem',
          width: '460px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeIn 0.2s ease both',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <h2>Share Dashboard</h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-tertiary)',
              border: 'none',
              fontSize: '1rem',
              cursor: 'pointer',
              padding: '0.2rem',
            }}
          >
            x
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <input
              value={searchQuery}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="Search users by name..."
              style={{ ...inputStyle, flex: 1 }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--green-border)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {searchResults.length > 0 && (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                backgroundColor: 'var(--surface-1)',
              }}
            >
              {searchResults.map((user) => (
                <div
                  key={user.oid}
                  onClick={() => grantAccess(user.oid)}
                  style={{
                    padding: '0.5rem 0.7rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>{user.display_name}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{user.upn}</div>
                  </div>
                  <span style={{ color: 'var(--green)', fontSize: '0.75rem', fontWeight: 500 }}>+ Add</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members */}
        <div style={{ marginBottom: '0.4rem' }}>
          <span
            style={{
              color: 'var(--text-tertiary)',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Members
          </span>
        </div>
        {loading ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Loading...</div>
        ) : permissions.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>No members yet.</div>
        ) : (
          <div>
            {permissions.map((p) => (
              <div
                key={p.user_oid}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.45rem 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>{p.user_oid}</span>
                  <span
                    style={{
                      color: 'var(--green)',
                      fontSize: '0.68rem',
                      backgroundColor: 'var(--green-bg)',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}
                  >
                    {p.role}
                  </span>
                </div>
                <button
                  onClick={() => revokeAccess(p.user_oid)}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--error)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    padding: '0.15rem 0.45rem',
                    fontFamily: 'var(--font-body)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(240, 72, 72, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
