// Thin client for the Cyber DNA FastAPI backend. Endpoint paths are fixed by the backend contract.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const ENDPOINTS = {
  overview: '/dashboard/overview',
  activity: '/dashboard/activity',
  alerts: '/alerts',
  incidents: '/incidents',
  users: '/users',
  hosts: '/hosts',
  events: '/events',
  rules: '/rules',
  detection: '/detection/status',
  findings: '/detection/findings',
  analystStatus: '/analyst/status',
  analystStatusCheck: '/analyst/status/check',
  correlation: '/correlation/status',
  health: '/health',
  collectorStatus: '/collector/status',
  // Server-side evidence-grounded AI analyst.
  assistantChat: '/analyst/ask',
};

export async function apiGet(path, params = {}, timeoutMs = 4000) {
  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const token = sessionStorage.getItem('cyberdna-token');
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json')) throw new Error('Not JSON');
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function apiPatch(path, body, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const token = sessionStorage.getItem('cyberdna-token');
    const res = await fetch(`${API_BASE}${path}`, { method: 'PATCH', signal: ctrl.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

export async function apiPost(path, body = {}, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const token = sessionStorage.getItem('cyberdna-token');
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', signal: ctrl.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}
