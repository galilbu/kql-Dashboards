import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RGL from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

import { api } from '../api/client';
import { useAuth } from '../auth';
import type { Dashboard, PanelConfig } from '../types';
import { Panel } from '../components/Panel';
import { ShareDialog } from '../components/ShareDialog';

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const GridLayout = RGL as unknown as React.ComponentType<{
  className?: string;
  layout: LayoutItem[];
  cols: number;
  rowHeight: number;
  width: number;
  onLayoutChange?: (layout: LayoutItem[]) => void;
  draggableHandle?: string;
  children: React.ReactNode;
}>;

const btnGhost: React.CSSProperties = {
  padding: '0.4rem 0.85rem',
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  transition: 'all 0.15s ease',
};

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

  // Debounce layout saves to prevent flickering from rapid onLayoutChange calls
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onLayoutChange = (layout: LayoutItem[]) => {
    const updated = panels.map((panel) => {
      const item = layout.find((l) => l.i === panel.id);
      if (item) {
        return { ...panel, x: item.x, y: item.y, w: item.w, h: item.h };
      }
      return panel;
    });
    setPanels(updated);
    // Debounce the API save — only save after 500ms of no changes
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePanels(updated), 500);
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
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        Dashboard not found.
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem 1.75rem', animation: 'fadeIn 0.3s ease both' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.4rem' }}>{dashboard.title}</h1>
          {dashboard.description && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
              {dashboard.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => navigate('/dashboards')}
            style={btnGhost}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            Back
          </button>
          <button
            onClick={() => setShowShare(true)}
            style={btnGhost}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            Share
          </button>
          <button
            onClick={addPanel}
            style={{
              padding: '0.4rem 0.85rem',
              backgroundColor: 'var(--green)',
              color: 'var(--text-inverse)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--green-light)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--green)')}
          >
            + Add Panel
          </button>
        </div>
      </div>

      {showShare && <ShareDialog dashboardId={id!} onClose={() => setShowShare(false)} />}

      <GridLayout
        className="layout"
        layout={panels.map((p) => ({ i: p.id, x: p.x, y: p.y, w: p.w, h: p.h }))}
        cols={12}
        rowHeight={80}
        width={window.innerWidth - 56}
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
      </GridLayout>
    </div>
  );
}
