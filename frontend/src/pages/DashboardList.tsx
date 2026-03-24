import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';
import type { Dashboard } from '../types';

export function DashboardList() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();

  const fetchDashboards = useCallback(async () => {
    try {
      const token = await getAccessToken(['openid']);
      const data = await api.get<{ dashboards: Dashboard[] }>('/dashboards', token);
      setDashboards(data.dashboards);
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
    return <div style={{ padding: '2rem', color: '#ccc' }}>Loading dashboards...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#fff', margin: 0 }}>Dashboards</h1>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#0078d4',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          + New Dashboard
        </button>
      </div>

      {showCreate && (
        <div
          style={{
            padding: '1.5rem',
            marginBottom: '1.5rem',
            backgroundColor: '#1a1a2e',
            borderRadius: '8px',
            border: '1px solid #333',
          }}
        >
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Dashboard title"
            style={{
              width: '100%',
              padding: '0.6rem',
              marginBottom: '0.75rem',
              backgroundColor: '#0f0f1a',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
            }}
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            style={{
              width: '100%',
              padding: '0.6rem',
              marginBottom: '0.75rem',
              backgroundColor: '#0f0f1a',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCreate}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#0078d4',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                color: '#ccc',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {dashboards.length === 0 ? (
        <p style={{ color: '#888' }}>No dashboards yet. Create one to get started.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {dashboards.map((d) => (
            <div
              key={d.id}
              onClick={() => navigate(`/dashboards/${d.id}`)}
              style={{
                padding: '1.25rem',
                backgroundColor: '#1a1a2e',
                borderRadius: '8px',
                border: '1px solid #333',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0078d4')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#333')}
            >
              <h3 style={{ color: '#fff', margin: '0 0 0.5rem' }}>{d.title}</h3>
              {d.description && (
                <p style={{ color: '#888', margin: 0, fontSize: '0.85rem' }}>{d.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
