/**
 * Local (invite-based) authentication hook.
 *
 * Stores the JWT in localStorage under 'local_auth_token'.
 * The token payload is decoded client-side (no sensitive data, just display info).
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'local_auth_token';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface LocalAuthUser {
  id: string;
  email: string;
  displayName: string;
  isSuperAdmin: boolean;
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodePayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return Date.now() / 1000 > payload.exp;
}

function getStoredToken(): string | null {
  const token = localStorage.getItem(STORAGE_KEY);
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return token;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

interface TokenResponse {
  access_token: string;
  user_id: string;
  display_name: string;
  email: string;
  is_super_admin: boolean;
}

export function useLocalAuth() {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [user, setUser] = useState<LocalAuthUser | null>(() => {
    const t = getStoredToken();
    if (!t) return null;
    const p = decodePayload(t);
    if (!p) return null;
    const flag = localStorage.getItem('local_auth_is_super_admin');
    return {
      id: String(p.sub ?? ''),
      email: String(p.email ?? ''),
      displayName: String(p.name ?? ''),
      isSuperAdmin: flag === 'true',
    };
  });

  const _storeSession = useCallback((resp: TokenResponse) => {
    localStorage.setItem(STORAGE_KEY, resp.access_token);
    localStorage.setItem('local_auth_is_super_admin', String(resp.is_super_admin));
    setToken(resp.access_token);
    setUser({
      id: resp.user_id,
      email: resp.email,
      displayName: resp.display_name,
      isSuperAdmin: resp.is_super_admin,
    });
  }, []);

  const loginLocal = useCallback(async (email: string, password: string) => {
    const resp = await apiPost<TokenResponse>('/auth/login', { email, password });
    _storeSession(resp);
  }, [_storeSession]);

  const registerLocal = useCallback(async (params: {
    inviteToken: string;
    email: string;
    displayName: string;
    password: string;
  }) => {
    const resp = await apiPost<TokenResponse>('/auth/register', {
      invite_token: params.inviteToken,
      email: params.email,
      display_name: params.displayName,
      password: params.password,
    });
    _storeSession(resp);
  }, [_storeSession]);

  const logoutLocal = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('local_auth_is_super_admin');
    setToken(null);
    setUser(null);
  }, []);

  const getLocalToken = useCallback((): string => {
    const t = getStoredToken();
    if (!t) throw new Error('Not authenticated');
    return t;
  }, []);

  return {
    isLocalAuthenticated: !!token,
    localUser: user,
    loginLocal,
    registerLocal,
    logoutLocal,
    getLocalToken,
  };
}
