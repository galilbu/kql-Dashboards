import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { QueryResult, Column } from '../types';
import { ResultsTable } from './ResultsTable';

interface ChartRendererProps {
  result: QueryResult;
  chartType: 'auto' | 'line' | 'bar' | 'pie' | 'table';
}

const COLORS = ['#0078d4', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#3498db'];

function inferChartType(columns: Column[]): 'line' | 'bar' | 'pie' | 'table' {
  if (columns.length < 2) return 'table';

  const hasTimeColumn = columns.some(
    (c) => c.type === 'datetime' || c.type === 'timespan' || c.name.toLowerCase().includes('time'),
  );

  if (hasTimeColumn) return 'line';

  const hasNumericColumn = columns.some(
    (c) => c.type === 'int' || c.type === 'long' || c.type === 'real' || c.type === 'decimal',
  );
  const hasCategoricalColumn = columns.some((c) => c.type === 'string');

  if (hasCategoricalColumn && hasNumericColumn) {
    if (columns.length === 2) return 'pie';
    return 'bar';
  }

  return 'table';
}

function toChartData(result: QueryResult): Record<string, any>[] {
  return result.rows.map((row) => {
    const obj: Record<string, any> = {};
    result.columns.forEach((col, i) => {
      obj[col.name] = row[i];
    });
    return obj;
  });
}

export function ChartRenderer({ result, chartType }: ChartRendererProps) {
  if (!result.columns.length || !result.rows.length) {
    return <div style={{ color: '#888', padding: '0.5rem', fontSize: '0.85rem' }}>No results.</div>;
  }

  const resolvedType = chartType === 'auto' ? inferChartType(result.columns) : chartType;
  const data = toChartData(result);

  if (resolvedType === 'table') {
    return <ResultsTable result={result} />;
  }

  const categoryCol = result.columns[0].name;
  const valueColumns = result.columns.slice(1).filter(
    (c) => c.type === 'int' || c.type === 'long' || c.type === 'real' || c.type === 'decimal' || c.type === 'datetime',
  );

  if (valueColumns.length === 0) {
    return <ResultsTable result={result} />;
  }

  if (resolvedType === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey={categoryCol} tick={{ fill: '#888', fontSize: 11 }} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
          <Legend />
          {valueColumns.map((col, i) => (
            <Line
              key={col.name}
              type="monotone"
              dataKey={col.name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (resolvedType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey={categoryCol} tick={{ fill: '#888', fontSize: 11 }} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
          <Legend />
          {valueColumns.map((col, i) => (
            <Bar key={col.name} dataKey={col.name} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (resolvedType === 'pie') {
    const nameKey = categoryCol;
    const valueKey = valueColumns[0].name;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius="70%"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return <ResultsTable result={result} />;
}
