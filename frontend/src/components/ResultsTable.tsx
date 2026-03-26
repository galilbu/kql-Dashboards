import type { QueryResult } from '../types';

interface ResultsTableProps {
  result: QueryResult;
}

export function ResultsTable({ result }: ResultsTableProps) {
  if (!result.columns.length) {
    return <div style={{ color: 'var(--text-tertiary)', padding: '0.5rem' }}>No results.</div>;
  }

  return (
    <div style={{ overflow: 'auto', maxHeight: '100%' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <thead>
          <tr>
            {result.columns.map((col) => (
              <th
                key={col.name}
                style={{
                  textAlign: 'left',
                  padding: '0.4rem 0.6rem',
                  borderBottom: '1px solid var(--green-border)',
                  backgroundColor: 'var(--surface-3)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                  position: 'sticky',
                  top: 0,
                }}
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              style={{
                backgroundColor: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {cell != null ? String(cell) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.partial && (
        <div
          style={{
            color: 'var(--warning)',
            padding: '0.4rem 0.6rem',
            fontSize: '0.78rem',
            marginTop: '0.4rem',
          }}
        >
          Results are partial — the query timed out before completing.
        </div>
      )}
    </div>
  );
}
