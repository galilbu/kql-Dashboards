import { useState } from 'react';
import { PanelConfig, QueryResult } from '../types';
import { KqlEditor } from './KqlEditor';
import { ChartRenderer } from './ChartRenderer';
import { ResultsTable } from './ResultsTable';
import { api } from '../api/client';
import { useAuth } from '../auth';

interface PanelProps {
  panel: PanelConfig;
  dashboardId: string;
  onUpdate: (updates: Partial<PanelConfig>) => void;
  onRemove: () => void;
}

export function Panel({ panel, dashboardId, onUpdate, onRemove }: PanelProps) {
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
        '/query',
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
        backgroundColor: '#1a1a2e',
        borderRadius: '8px',
        border: '1px solid #333',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        className="panel-drag-handle"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          backgroundColor: '#16213e',
          cursor: 'grab',
          borderBottom: '1px solid #333',
          minHeight: '36px',
        }}
      >
        <input
          value={panel.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '0.85rem',
            fontWeight: 600,
            flex: 1,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <select
            value={panel.chartType}
            onChange={(e) => onUpdate({ chartType: e.target.value as PanelConfig['chartType'] })}
            style={{
              backgroundColor: '#0f0f1a',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: '3px',
              fontSize: '0.75rem',
              padding: '0.15rem 0.3rem',
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
            style={{
              backgroundColor: 'transparent',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: '3px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: '0.15rem 0.4rem',
            }}
          >
            {editing ? 'Hide' : 'Edit'}
          </button>
          <button
            onClick={onRemove}
            style={{
              backgroundColor: 'transparent',
              color: '#e74c3c',
              border: '1px solid #444',
              borderRadius: '3px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: '0.15rem 0.4rem',
            }}
          >
            X
          </button>
        </div>
      </div>

      {/* Editor section */}
      {editing && (
        <div style={{ borderBottom: '1px solid #333' }}>
          <KqlEditor
            value={panel.kql}
            onChange={(kql) => onUpdate({ kql })}
            height="120px"
          />
          <div style={{ padding: '0.4rem 0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={runQuery}
              disabled={loading}
              style={{
                padding: '0.3rem 0.8rem',
                backgroundColor: '#27ae60',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
              }}
            >
              {loading ? 'Running...' : 'Run Query'}
            </button>
          </div>
        </div>
      )}

      {/* Results section */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
        {error && (
          <div style={{ color: '#e74c3c', padding: '0.5rem', fontSize: '0.85rem' }}>{error}</div>
        )}
        {loading && <div style={{ color: '#888', padding: '0.5rem' }}>Executing query...</div>}
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
          <div style={{ color: '#555', padding: '0.5rem', fontSize: '0.85rem' }}>
            Click "Edit" to write a KQL query.
          </div>
        )}
      </div>
    </div>
  );
}
