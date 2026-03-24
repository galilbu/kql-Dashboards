import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';
import type { Permission, UserSearchResult } from '../types';

interface ShareDialogProps {
  dashboardId: string;
  onClose: () => void;
}

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
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: '#1a1a2e',
          borderRadius: '12px',
          border: '1px solid #333',
          padding: '1.5rem',
          width: '480px',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>Share Dashboard</h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              color: '#888',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Search and add */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              value={searchQuery}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="Search users by name..."
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: '#0f0f1a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
                fontSize: '0.85rem',
              }}
            />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{
                padding: '0.5rem',
                backgroundColor: '#0f0f1a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
                fontSize: '0.85rem',
              }}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {searchResults.length > 0 && (
            <div
              style={{
                border: '1px solid #444',
                borderRadius: '4px',
                overflow: 'hidden',
                backgroundColor: '#0f0f1a',
              }}
            >
              {searchResults.map((user) => (
                <div
                  key={user.oid}
                  onClick={() => grantAccess(user.oid)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#16213e')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div>
                    <div style={{ color: '#fff', fontSize: '0.85rem' }}>{user.display_name}</div>
                    <div style={{ color: '#888', fontSize: '0.75rem' }}>{user.upn}</div>
                  </div>
                  <span style={{ color: '#0078d4', fontSize: '0.8rem' }}>+ Add</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current members */}
        <h3 style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Current Members</h3>
        {loading ? (
          <div style={{ color: '#888' }}>Loading...</div>
        ) : permissions.length === 0 ? (
          <div style={{ color: '#888', fontSize: '0.85rem' }}>No members yet.</div>
        ) : (
          <div>
            {permissions.map((p) => (
              <div
                key={p.user_oid}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #2a2a3e',
                }}
              >
                <div>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>{p.user_oid}</span>
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      color: '#888',
                      fontSize: '0.75rem',
                      backgroundColor: '#16213e',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '3px',
                    }}
                  >
                    {p.role}
                  </span>
                </div>
                <button
                  onClick={() => revokeAccess(p.user_oid)}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#e74c3c',
                    border: '1px solid #444',
                    borderRadius: '3px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: '0.2rem 0.5rem',
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
