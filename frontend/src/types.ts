export interface Column {
  name: string;
  type: string;
}

export interface QueryResult {
  columns: Column[];
  rows: (string | number | boolean | null)[][];
  partial?: boolean;
}

export interface PanelConfig {
  id: string;
  title: string;
  kql: string;
  chartType: 'auto' | 'line' | 'bar' | 'pie' | 'table';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dashboard {
  id: string;
  title: string;
  description: string;
  panels: string; // JSON-serialized PanelConfig[]
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  dashboard_id: string;
  user_oid: string;
  role: 'viewer' | 'editor' | 'admin';
  granted_by: string;
  granted_at: string;
}

export interface UserSearchResult {
  oid: string;
  display_name: string;
  upn: string;
  email: string;
}
