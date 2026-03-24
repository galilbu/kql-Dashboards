import { QueryResult } from '../types';

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
        color: '#888',
        border: '1px solid #444',
        borderRadius: '3px',
        fontSize: '0.7rem',
        cursor: 'pointer',
      }}
    >
      Export CSV
    </button>
  );
}
