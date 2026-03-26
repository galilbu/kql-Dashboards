import type { QueryResult } from '../types';

interface ExportCsvProps {
  result: QueryResult;
  filename?: string;
}

export function ExportCsv({ result, filename = 'query-results' }: ExportCsvProps) {
  const handleExport = () => {
    const header = result.columns.map((c) => c.name).join(',');
    const rows = result.rows.map((row) =>
      row
        .map((cell) => {
          const str = cell != null ? String(cell) : '';
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      style={{
        padding: '0.2rem 0.5rem',
        backgroundColor: 'transparent',
        color: 'var(--text-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.68rem',
        fontFamily: 'var(--font-body)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--green-border)';
        e.currentTarget.style.color = 'var(--green)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = 'var(--text-tertiary)';
      }}
    >
      Export CSV
    </button>
  );
}
