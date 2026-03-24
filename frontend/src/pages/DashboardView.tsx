import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

import { api } from '../api/client';
import { useAuth } from '../auth';
import type { Dashboard, PanelConfig } from '../types';
import { Panel } from '../components/Panel';
import { ShareDialog } from '../components/ShareDialog';

export function DashboardView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [panels, setPanels] = useState<PanelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!id) return;
    try {
      const token = await getAccessToken(['openid']);
      const data = await api.get<Dashboard>(`/dashboards/${id}`, token);
      setDashboard(data);
      setPanels(JSON.parse(data.panels || '[]'));
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
      navigate('/dashboards');
    } finally {
      setLoading(false);
    }
  }, [id, getAccessToken, navigate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const savePanels = useCallback(
    async (updatedPanels: PanelConfig[]) => {
      if (!id) return;
      try {
        const token = await getAccessToken(['openid']);
        await api.put(`/dashboards/${id}`, { panels: JSON.stringify(updatedPanels) }, token);
      } catch (err) {
        console.error('Failed to save panels:', err);
      }
    },
    [id, getAccessToken],
  );

  const addPanel = () => {
    const newPanel: PanelConfig = {
      id: crypto.randomUUID(),
      title: 'New Panel',
      kql: '',
      chartType: 'auto',
      x: 0,
      y: Infinity,
      w: 6,
      h: 4,
    };
    const updated = [...panels, newPanel];
    setPanels(updated);
    savePanels(updated);
  };

  const updatePanel = (panelId: string, updates: Partial<PanelConfig>) => {
    const updated = panels.map((p) => (p.id === panelId ? { ...p, ...updates } : p));
    setPanels(updated);
    savePanels(updated);
  };

  const removePanel = (panelId: string) => {
    const updated = panels.filter((p) => p.id !== panelId);
    setPanels(updated);
    savePanels(updated);
  };

  const onLayoutChange = (layout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
    const updated = panels.map((panel) => {
      const item = layout.find((l) => l.i === panel.id);
      if (item) {
        return { ...panel, x: item.x, y: item.y, w: item.w, h: item.h };
      }
      return panel;
    });
    setPanels(updated);
    savePanels(updated);
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: '#ccc' }}>Loading dashboard...</div>;
  }

  if (!dashboard) {
    return <div style={{ padding: '2rem', color: '#ccc' }}>Dashboard not found.</div>;
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h1 style={{ color: '#fff', margin: '0 0 0.25rem' }}>{dashboard.title}</h1>
          {dashboard.description && (
            <p style={{ color: '#888', margin: 0, fontSize: '0.85rem' }}>{dashboard.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowShare(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: '#ccc',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Share
          </button>
          <button
            onClick={addPanel}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0078d4',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            + Add Panel
          </button>
          <button
            onClick={() => navigate('/dashboards')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: '#ccc',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        </div>
      </div>

      {showShare && <ShareDialog dashboardId={id!} onClose={() => setShowShare(false)} />}

      <ReactGridLayout
        className="layout"
        layout={panels.map((p) => ({ i: p.id, x: p.x, y: p.y, w: p.w, h: p.h }))}
        cols={12}
        rowHeight={80}
        width={window.innerWidth - 48}
        onLayoutChange={onLayoutChange}
        draggableHandle=".panel-drag-handle"
      >
        {panels.map((panel) => (
          <div key={panel.id}>
            <Panel
              panel={panel}
              dashboardId={id!}
              onUpdate={(updates) => updatePanel(panel.id, updates)}
              onRemove={() => removePanel(panel.id)}
            />
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
}
