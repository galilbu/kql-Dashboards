import { useState, useEffect, useRef } from 'react';
import type { PanelConfig, QueryResult, GenerateKqlResponse } from '../types';
import { KqlEditor } from './KqlEditor';
import { ChartRenderer } from './ChartRenderer';
import { ResultsTable } from './ResultsTable';
import { api } from '../api/client';
import { useAuth } from '../auth';

interface PanelProps {
  panel: PanelConfig;
  dashboardId: string;
  editMode?: boolean;
  refreshKey?: number;
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

export function Panel({ panel, dashboardId, editMode, refreshKey, onUpdate, onRemove }: PanelProps) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!panel.kql);
  const { getAccessToken } = useAuth();
  const lastRefreshKey = useRef(refreshKey);

  // AI generation state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');
  const [showAi, setShowAi] = useState(false);

  // Re-run query when refreshKey changes (manual or auto-refresh)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== lastRefreshKey.current && panel.kql.trim()) {
      lastRefreshKey.current = refreshKey;
      runQueryInternal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const runQueryInternal = async () => {
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

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError('');
    setAiExplanation('');
    try {
      const token = await getAccessToken(['openid']);
      const data = await api.post<GenerateKqlResponse>(
        '/generate-kql',
        { description: aiPrompt.trim(), dashboard_id: dashboardId },
        token,
      );
      onUpdate({
        kql: data.kql,
        title: data.title,
        chartType: (data.chart_type as PanelConfig['chartType']) || 'auto',
      });
      setAiExplanation(data.explanation);
      setShowAi(false);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setAiGenerating(false);
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
        position: 'relative',
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
          {/* AI Describe toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.7rem',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--surface-1)',
          }}>
            <button
              onClick={() => setShowAi(!showAi)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.6rem',
                backgroundColor: showAi ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                color: showAi ? '#a78bfa' : 'var(--text-tertiary)',
                border: `1px solid ${showAi ? 'rgba(139, 92, 246, 0.2)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Describe with AI
            </button>
            {aiExplanation && !showAi && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                {aiExplanation}
              </span>
            )}
          </div>

          {/* AI Input */}
          {showAi && (
            <div style={{
              padding: '0.6rem 0.7rem',
              backgroundColor: 'rgba(139, 92, 246, 0.03)',
              borderBottom: '1px solid var(--border)',
            }}>
              <textarea
                value={aiPrompt}
                onChange={(e) => { setAiPrompt(e.target.value); setAiError(''); }}
                placeholder="Describe what you want to see, e.g. 'Show failed sign-ins by country in the last 24 hours'"
                style={{
                  width: '100%',
                  minHeight: '52px',
                  padding: '0.5rem 0.6rem',
                  backgroundColor: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-body)',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAiGenerate();
                  }
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', alignItems: 'center' }}>
                <button
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  style={{
                    padding: '0.3rem 0.75rem',
                    backgroundColor: aiGenerating || !aiPrompt.trim() ? 'var(--surface-4)' : '#8b5cf6',
                    color: aiGenerating || !aiPrompt.trim() ? 'var(--text-tertiary)' : '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: aiGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {aiGenerating ? 'Generating...' : 'Generate KQL'}
                </button>
                {aiError && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>
                    {aiError}
                  </span>
                )}
              </div>
            </div>
          )}

          <KqlEditor
            value={panel.kql}
            onChange={(kql) => onUpdate({ kql })}
            height="120px"
          />
          <div style={{ padding: '0.35rem 0.7rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              onClick={runQueryInternal}
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
            {aiExplanation && (
              <span style={{ fontSize: '0.7rem', color: '#a78bfa', fontStyle: 'italic' }}>
                AI: {aiExplanation}
              </span>
            )}
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

      {/* Bottom-left drag handle — only in edit mode */}
      {editMode && (
        <div
          className="panel-drag-handle"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '28px',
            height: '28px',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
            opacity: 0.5,
            transition: 'opacity 0.15s ease',
            zIndex: 1,
          }}
          title="Drag to move"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="4" r="1.5" />
            <circle cx="10" cy="4" r="1.5" />
            <circle cx="4" cy="10" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
}
