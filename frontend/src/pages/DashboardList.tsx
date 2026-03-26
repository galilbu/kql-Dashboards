import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';
import type { Dashboard } from '../types';

interface MyPermission {
  dashboard_id: string;
  dashboard_title: string;
  role: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.8rem',
  backgroundColor: 'var(--surface-1)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.85rem',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.15s ease',
};

export function DashboardList() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [myPerms, setMyPerms] = useState<MyPermission[]>([]);
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();

  const fetchDashboards = useCallback(async () => {
    try {
      const token = await getAccessToken(['openid']);
      const data = await api.get<{ dashboards: Dashboard[] }>('/dashboards', token);
      setDashboards(data.dashboards);
      // Fetch user's own permissions
      const permsData = await api.get<{ permissions: MyPermission[] }>('/users/me/permissions', token);
      setMyPerms(permsData.permissions);
    } catch (err) {
      console.error('Failed to fetch dashboards:', err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const token = await getAccessToken(['openid']);
      const created = await api.post<Dashboard>('/dashboards', { title: newTitle, description: newDesc }, token);
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      navigate(`/dashboards/${created.id}`);
    } catch (err) {
      console.error('Failed to create dashboard:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            backgroundColor: 'var(--green)',
            borderRadius: '50%',
            animation: 'pulse 1.2s ease-in-out infinite',
          }}
        />
        <p style={{ color: 'var(--text-tertiary)', marginTop: '0.75rem', fontSize: '0.85rem' }}>
          Loading dashboards...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '2.5rem 2rem',
        maxWidth: '960px',
        margin: '0 auto',
        animation: 'fadeIn 0.35s ease both',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1>Dashboards</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '0.5rem 1.1rem',
            backgroundColor: 'var(--green)',
            color: 'var(--text-inverse)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--green-light)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--green)')}
        >
          + New Dashboard
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div
          style={{
            padding: '1.25rem',
            marginBottom: '1.5rem',
            backgroundColor: 'var(--surface-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            animation: 'fadeIn 0.2s ease both',
          }}
        >
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Dashboard title"
            style={{ ...inputStyle, marginBottom: '0.6rem' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--green-border)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            style={{ ...inputStyle, marginBottom: '0.85rem' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--green-border)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCreate}
              style={{
                padding: '0.45rem 1rem',
                backgroundColor: 'var(--green)',
                color: 'var(--text-inverse)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{
                padding: '0.45rem 1rem',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '0.82rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cards */}
      {dashboards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-tertiary)' }}>
          <p style={{ fontSize: '0.9rem' }}>No dashboards yet. Create one to get started.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {dashboards.map((d, i) => (
            <div
              key={d.id}
              onClick={() => navigate(`/dashboards/${d.id}`)}
              style={{
                padding: '1.15rem 1.25rem',
                backgroundColor: 'var(--surface-2)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--green-border)';
                e.currentTarget.style.backgroundColor = 'var(--surface-3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'var(--surface-2)';
              }}
            >
              <h3 style={{ marginBottom: d.description ? '0.3rem' : 0 }}>{d.title}</h3>
              {d.description && (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', lineHeight: 1.45 }}>
                  {d.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* My Permissions */}
      {myPerms.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            My Permissions
          </h2>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {myPerms.map((p) => (
              <span
                key={p.dashboard_id}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.6rem',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                }}
              >
                {p.dashboard_title}:{' '}
                <span style={{ color: 'var(--green)', fontWeight: 500, textTransform: 'capitalize' }}>
                  {p.role}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
