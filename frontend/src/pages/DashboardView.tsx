import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GridLayout } from 'react-grid-layout';
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
  static?: boolean;
}

const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '1 min', value: 60_000 },
  { label: '5 min', value: 300_000 },
  { label: '10 min', value: 600_000 },
  { label: '30 min', value: 1_800_000 },
];

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
  const [editMode, setEditMode] = useState(false);

  // Refresh state
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefreshMs, setAutoRefreshMs] = useState(0);
  const [showRefreshMenu, setShowRefreshMenu] = useState(false);
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const refreshMenuRef = useRef<HTMLDivElement>(null);

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

  // Auto-refresh interval
  useEffect(() => {
    clearInterval(autoRefreshTimer.current);
    if (autoRefreshMs > 0) {
      autoRefreshTimer.current = setInterval(() => {
        setRefreshKey((k) => k + 1);
      }, autoRefreshMs);
    }
    return () => clearInterval(autoRefreshTimer.current);
  }, [autoRefreshMs]);

  // Close refresh menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (refreshMenuRef.current && !refreshMenuRef.current.contains(e.target as Node)) {
        setShowRefreshMenu(false);
      }
    };
    if (showRefreshMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showRefreshMenu]);

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

  const onLayoutChange = (layout: readonly LayoutItem[]) => {
    const updated = panels.map((panel) => {
      const item = layout.find((l) => l.i === panel.id);
      if (item) {
        return { ...panel, x: item.x, y: item.y, w: item.w, h: item.h };
      }
      return panel;
    });
    setPanels(updated);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePanels(updated), 500);
  };

  const handleManualRefresh = () => {
    setRefreshKey((k) => k + 1);
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

  const activeRefreshLabel = REFRESH_OPTIONS.find((o) => o.value === autoRefreshMs)?.label || 'Off';

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
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* Refresh button + auto-refresh dropdown */}
          <div style={{ position: 'relative', display: 'flex', gap: 0 }} ref={refreshMenuRef}>
            <button
              onClick={handleManualRefresh}
              style={{
                ...btnGhost,
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                borderRight: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              title="Refresh all panels"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => setShowRefreshMenu(!showRefreshMenu)}
              style={{
                ...btnGhost,
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                padding: '0.4rem 0.4rem',
                fontSize: '0.65rem',
                ...(autoRefreshMs > 0 ? {
                  backgroundColor: 'var(--green-bg)',
                  color: 'var(--green)',
                  borderColor: 'var(--green-border)',
                } : {}),
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = autoRefreshMs > 0 ? 'var(--green-border)' : 'var(--border-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = autoRefreshMs > 0 ? 'var(--green-border)' : 'var(--border)')}
              title={`Auto-refresh: ${activeRefreshLabel}`}
            >
              ▼
            </button>
            {showRefreshMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.3rem',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 100,
                  minWidth: '120px',
                  overflow: 'hidden',
                }}
              >
                {REFRESH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setAutoRefreshMs(opt.value);
                      setShowRefreshMenu(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.45rem 0.75rem',
                      backgroundColor: autoRefreshMs === opt.value ? 'var(--green-bg)' : 'transparent',
                      color: autoRefreshMs === opt.value ? 'var(--green)' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-body)',
                      fontWeight: autoRefreshMs === opt.value ? 600 : 400,
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (autoRefreshMs !== opt.value) e.currentTarget.style.backgroundColor = 'var(--surface-3)';
                    }}
                    onMouseLeave={(e) => {
                      if (autoRefreshMs !== opt.value) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {opt.label}
                    {autoRefreshMs === opt.value && ' ✓'}
                  </button>
                ))}
              </div>
            )}
          </div>

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
            onClick={() => setEditMode(!editMode)}
            style={{
              ...btnGhost,
              backgroundColor: editMode ? 'var(--green-bg)' : 'transparent',
              color: editMode ? 'var(--green)' : 'var(--text-secondary)',
              borderColor: editMode ? 'var(--green-border)' : 'var(--border)',
            }}
          >
            {editMode ? 'Done' : 'Edit Layout'}
          </button>
          {editMode && <button
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
          </button>}
        </div>
      </div>

      {showShare && <ShareDialog dashboardId={id!} onClose={() => setShowShare(false)} />}

      <GridLayout
        className="layout"
        layout={panels.map((p) => ({
          i: p.id, x: p.x, y: p.y, w: p.w, h: p.h,
          static: !editMode,
        }))}
        width={window.innerWidth - 260}
        onLayoutChange={editMode ? onLayoutChange : undefined}
        dragConfig={{
          enabled: editMode,
          handle: '.panel-drag-handle',
          cancel: 'input, select, button, textarea, .cm-editor',
        }}
        resizeConfig={{
          enabled: editMode,
          handles: ['se'],
        }}
        gridConfig={{
          cols: 12,
          rowHeight: 80,
        }}
      >
        {panels.map((panel) => (
          <div key={panel.id}>
            <Panel
              panel={panel}
              dashboardId={id!}
              editMode={editMode}
              refreshKey={refreshKey}
              onUpdate={(updates) => updatePanel(panel.id, updates)}
              onRemove={() => removePanel(panel.id)}
            />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
