import { useState } from 'react';
import type { PanelConfig, QueryResult } from '../types';
import { KqlEditor } from './KqlEditor';
import { ChartRenderer } from './ChartRenderer';
import { ResultsTable } from './ResultsTable';
import { api } from '../api/client';
import { useAuth } from '../auth';

interface PanelProps {
  panel: PanelConfig;
  dashboardId: string;
  editMode?: boolean;
  onUpdate: (updates: Partial<PanelConfig>) => void;
  onRemove: () => void;
}

const smallBtn: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: 'var(--text-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.7rem',
  cursor: 'pointer',
  padding: '0.15rem 0.4rem',
  fontFamily: 'var(--font-body)',
  transition: 'all 0.15s ease',
};

export function Panel({ panel, dashboardId, editMode, onUpdate, onRemove }: PanelProps) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!panel.kql);
  const { getAccessToken } = useAuth();

  const runQuery = async () => {
    if (!panel.kql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken(['openid']);
      const data = await api.post<QueryResult>(
        `/query?dashboard_id=${dashboardId}`,
        { kql: panel.kql, dashboard_id: dashboardId },
        token,
      );
      setResult(data);
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.4rem 0.7rem',
          backgroundColor: 'var(--surface-3)',
          borderBottom: '1px solid var(--border)',
          minHeight: '32px',
        }}
      >
        {/* Drag grip — only this small area is draggable */}
        {editMode && (
          <div
            className="panel-drag-handle"
            style={{
              cursor: 'grab',
              padding: '0 0.3rem 0 0',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-tertiary)',
              flexShrink: 0,
            }}
            title="Drag to move"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
          </div>
        )}
        <input
          value={panel.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            flex: 1,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          <select
            value={panel.chartType}
            onChange={(e) => onUpdate({ chartType: e.target.value as PanelConfig['chartType'] })}
            style={{
              backgroundColor: 'var(--surface-1)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.7rem',
              padding: '0.12rem 0.25rem',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            <option value="auto">Auto</option>
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="pie">Pie</option>
            <option value="table">Table</option>
          </select>
          <button
            onClick={() => setEditing(!editing)}
            style={smallBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--green-border)';
              e.currentTarget.style.color = 'var(--green)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            {editing ? 'Hide' : 'Edit'}
          </button>
          <button
            onClick={onRemove}
            style={{ ...smallBtn, color: 'var(--error)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(240, 72, 72, 0.3)';
              e.currentTarget.style.backgroundColor = 'rgba(240, 72, 72, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            X
          </button>
        </div>
      </div>

      {/* Editor */}
      {editing && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <KqlEditor
            value={panel.kql}
            onChange={(kql) => onUpdate({ kql })}
            height="120px"
          />
          <div style={{ padding: '0.35rem 0.7rem', display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={runQuery}
              disabled={loading}
              style={{
                padding: '0.3rem 0.75rem',
                backgroundColor: loading ? 'var(--surface-4)' : 'var(--green)',
                color: loading ? 'var(--text-tertiary)' : 'var(--text-inverse)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                transition: 'background-color 0.15s ease',
              }}
            >
              {loading ? 'Running...' : 'Run Query'}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0.4rem' }}>
        {error && (
          <div
            style={{
              color: 'var(--error)',
              padding: '0.4rem 0.5rem',
              fontSize: '0.8rem',
              backgroundColor: 'rgba(240, 72, 72, 0.06)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {error}
          </div>
        )}
        {loading && (
          <div style={{ color: 'var(--text-tertiary)', padding: '0.5rem', fontSize: '0.8rem' }}>
            Executing query...
          </div>
        )}
        {result && !loading && (
          <>
            {panel.chartType === 'table' ? (
              <ResultsTable result={result} />
            ) : (
              <ChartRenderer result={result} chartType={panel.chartType} />
            )}
          </>
        )}
        {!result && !loading && !error && !editing && (
          <div
            style={{
              color: 'var(--text-tertiary)',
              padding: '1.5rem',
              fontSize: '0.8rem',
              textAlign: 'center',
            }}
          >
            Click "Edit" to write a KQL query.
          </div>
        )}
      </div>
    </div>
  );
}
