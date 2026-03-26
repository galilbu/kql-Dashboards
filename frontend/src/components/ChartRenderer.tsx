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
import type { QueryResult, Column } from '../types';
import { ResultsTable } from './ResultsTable';

interface ChartRendererProps {
  result: QueryResult;
  chartType: 'auto' | 'line' | 'bar' | 'pie' | 'table';
}

const COLORS = [
  '#13C636', /* green */
  '#4ea4f7', /* blue */
  '#f5a623', /* amber */
  '#e86054', /* coral */
  '#a78bfa', /* violet */
  '#38bec9', /* teal */
  '#f06898', /* pink */
  '#6BF5C0', /* mint */
];

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

function toChartData(result: QueryResult): Record<string, string | number | boolean | null>[] {
  return result.rows.map((row) => {
    const obj: Record<string, string | number | boolean | null> = {};
    result.columns.forEach((col, i) => {
      obj[col.name] = row[i];
    });
    return obj;
  });
}

const tooltipStyle = {
  backgroundColor: '#191935',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '6px',
  fontSize: '0.78rem',
};

const axisTickStyle = { fill: '#5c5c78', fontSize: 10 };
const axisStroke = 'rgba(255,255,255,0.05)';

export function ChartRenderer({ result, chartType }: ChartRendererProps) {
  if (!result.columns.length || !result.rows.length) {
    return <div style={{ color: 'var(--text-tertiary)', padding: '0.5rem', fontSize: '0.82rem' }}>No results.</div>;
  }

  const resolvedType = chartType === 'auto' ? inferChartType(result.columns) : chartType;
  const data = toChartData(result);

  if (resolvedType === 'table') return <ResultsTable result={result} />;

  const categoryCol = result.columns[0].name;
  const valueColumns = result.columns.slice(1).filter(
    (c) => c.type === 'int' || c.type === 'long' || c.type === 'real' || c.type === 'decimal' || c.type === 'datetime',
  );

  if (valueColumns.length === 0) return <ResultsTable result={result} />;

  if (resolvedType === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
          <XAxis dataKey={categoryCol} tick={axisTickStyle} stroke={axisStroke} />
          <YAxis tick={axisTickStyle} stroke={axisStroke} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
          {valueColumns.map((col, i) => (
            <Line
              key={col.name}
              type="monotone"
              dataKey={col.name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: COLORS[i % COLORS.length] }}
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
          <XAxis dataKey={categoryCol} tick={axisTickStyle} stroke={axisStroke} />
          <YAxis tick={axisTickStyle} stroke={axisStroke} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
          {valueColumns.map((col, i) => (
            <Bar key={col.name} dataKey={col.name} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
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
            innerRadius="40%"
            strokeWidth={1}
            stroke="#111128"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return <ResultsTable result={result} />;
}
