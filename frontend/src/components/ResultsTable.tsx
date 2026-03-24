import { QueryResult } from '../types';

interface ResultsTableProps {
  result: QueryResult;
}

export function ResultsTable({ result }: ResultsTableProps) {
  if (!result.columns.length) {
    return <div style={{ color: '#888', padding: '0.5rem' }}>No results.</div>;
  }

  return (
    <div style={{ overflow: 'auto', maxHeight: '100%' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.8rem',
          color: '#ccc',
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
                  borderBottom: '1px solid #444',
                  backgroundColor: '#16213e',
                  color: '#fff',
                  fontWeight: 600,
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
            <tr key={rowIdx} style={{ backgroundColor: rowIdx % 2 === 0 ? 'transparent' : '#1a1a2e' }}>
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderBottom: '1px solid #2a2a3e',
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
        <div style={{ color: '#f39c12', padding: '0.5rem', fontSize: '0.8rem' }}>
          Results are partial — the query timed out before completing.
        </div>
      )}
    </div>
  );
}
