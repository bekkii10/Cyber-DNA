// Maps backend payloads to the shapes the UI uses. Adjust field names here if the API schema differs.
const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };
export const asList = (r) => (Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : Array.isArray(r?.results) ? r.results : Array.isArray(r?.data) ? r.data : null);
const SEV = ['critical', 'high', 'medium', 'low', 'info'];
export const sev = (v) => { const s = String(v ?? 'info').toLowerCase(); return SEV.includes(s) ? s : 'info'; };
const title = (v, d) => (v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : d);

export const adaptAlert = (a) => ({
  id: String(pick(a, 'id', 'alert_id') ?? '—'),
  severity: sev(pick(a, 'severity', 'level')),
  title: pick(a, 'title', 'name', 'rule_name') ?? 'Alert',
  eventId: pick(a, 'event_id', 'eventId') ?? '—',
  user: pick(a, 'username', 'user', 'account') ?? '—',
  ip: pick(a, 'source_ip', 'ip', 'sourceIp') ?? '—',
  host: pick(a, 'host', 'hostname', 'computer') ?? '—',
  ts: pick(a, 'timestamp', 'created_at', 'ts', 'time') ?? new Date().toISOString(),
  status: title(pick(a, 'status'), 'New'),
  rule: pick(a, 'rule', 'rule_name') ?? '—',
  description: pick(a, 'description', 'message') ?? '',
});

export const adaptIncident = (i) => ({
  id: String(pick(i, 'id', 'incident_id') ?? '—'),
  title: pick(i, 'title', 'name') ?? 'Incident',
  severity: sev(pick(i, 'severity')),
  status: title(pick(i, 'status'), 'Open'),
  users: pick(i, 'affected_users', 'users') ?? [],
  hosts: pick(i, 'affected_hosts', 'hosts') ?? [],
  ts: pick(i, 'created_at', 'timestamp', 'ts') ?? new Date().toISOString(),
  summary: pick(i, 'summary', 'description') ?? '',
  timeline: pick(i, 'timeline') ?? [],
  events: pick(i, 'related_events', 'events') ?? [],
});

export const adaptHost = (h) => ({
  hostname: pick(h, 'hostname', 'name') ?? '—',
  ip: pick(h, 'ip', 'ip_address') ?? '—',
  os: pick(h, 'os', 'operating_system') ?? '—',
  status: title(pick(h, 'status'), 'Online'),
  ts: pick(h, 'last_seen', 'lastSeen', 'ts') ?? new Date().toISOString(),
  risk: Number(pick(h, 'risk', 'risk_score') ?? 0),
  events: Number(pick(h, 'event_count', 'events') ?? 0),
  role: pick(h, 'role') ?? '',
});

export const adaptRule = (r) => ({
  id: String(pick(r, 'id', 'rule_id') ?? '—'),
  name: pick(r, 'name', 'title') ?? 'Rule',
  eventId: pick(r, 'event_id', 'eventId') ?? '—',
  severity: sev(pick(r, 'severity')),
  enabled: pick(r, 'enabled', 'is_enabled') ?? true,
  hits: Number(pick(r, 'hits', 'hits_24h') ?? 0),
  mitre: pick(r, 'mitre', 'mitre_id') ?? '—',
  description: pick(r, 'description') ?? '',
});

export const adaptUser = (u) => {
  const zeros = Array(24).fill(0);
  return {
    username: pick(u, 'username', 'name') ?? '—',
    display: pick(u, 'display_name', 'display') ?? pick(u, 'username', 'name') ?? '—',
    dept: pick(u, 'department', 'dept') ?? '—',
    risk: Number(pick(u, 'risk', 'risk_score') ?? 0),
    anomaly: Number(pick(u, 'anomaly', 'anomaly_score') ?? 0),
    trend: pick(u, 'trend') ?? 'flat',
    ts: pick(u, 'last_seen', 'ts') ?? new Date().toISOString(),
    behavior: pick(u, 'behavior_type', 'behavior') ?? 'Normal behavior',
    baseline: pick(u, 'baseline') ?? { hours: '—', computers: [], ips: [], loginsPerDay: 0 },
    hourlyBaseline: pick(u, 'hourly_baseline', 'hourlyBaseline') ?? zeros,
    hourlyToday: pick(u, 'hourly_today', 'hourlyToday') ?? zeros,
    riskTrend: pick(u, 'risk_trend', 'riskTrend') ?? [],
    knownComputers: pick(u, 'known_computers', 'knownComputers') ?? [],
    knownIps: pick(u, 'known_ips', 'knownIps') ?? [],
    anomalies: pick(u, 'anomalies') ?? [],
    what: pick(u, 'what_happened', 'what') ?? '',
    means: pick(u, 'what_it_means', 'means') ?? '',
    recommendation: pick(u, 'recommendation') ?? '',
  };
};
