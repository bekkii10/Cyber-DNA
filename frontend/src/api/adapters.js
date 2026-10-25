// Maps backend payloads to the shapes the UI uses.
const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };
export const asList = (r) => (Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : Array.isArray(r?.results) ? r.results : Array.isArray(r?.data) ? r.data : null);
const SEV = ['critical', 'high', 'medium', 'low', 'info'];
export const sev = (v) => { const s = String(v ?? 'info').toLowerCase(); return SEV.includes(s) ? s : 'info'; };
const title = (v, d) => (v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : d);

// ---- Alerts ----
// Backend: AlertResponse { id, severity, rule, score, user, host, ip, time, detail, source, explanation, seen }
export const adaptAlert = (a) => ({
  id: String(pick(a, 'id', 'alert_id') ?? '—'),
  severity: sev(pick(a, 'severity', 'level')),
  title: pick(a, 'title', 'rule', 'rule_name', 'name') ?? 'Alert',
  eventId: pick(a, 'event_id', 'eventId') ?? '—',
  user: pick(a, 'user', 'username', 'account') ?? '—',
  ip: pick(a, 'ip', 'source_ip', 'sourceIp') ?? '—',
  host: pick(a, 'host', 'hostname', 'computer') ?? '—',
  ts: pick(a, 'time', 'timestamp', 'created_at', 'ts') ?? null,
  status: title(pick(a, 'status'), pick(a, 'seen') ? 'Acknowledged' : 'New'),
  rule: pick(a, 'rule', 'rule_name') ?? '—',
  description: pick(a, 'detail', 'description', 'message', 'explanation') ?? '',
  source: pick(a, 'source') ?? '',
  detectionSource: pick(a, 'detection_source', 'detectionSource') ?? (pick(a, 'rule_id') ? 'rule' : 'unknown'),
  ruleId: pick(a, 'rule_id') ?? null,
  explanation: pick(a, 'explanation') ?? '',
  score: Number(pick(a, 'score') ?? 0),
  seen: Boolean(pick(a, 'seen') ?? false),
});

// ---- Incidents ----
// Backend: IncidentResponse { id, title, risk, score, status, users, hosts, first_seen, last_seen, chain, related_alerts, related_events }
export const adaptIncident = (i) => ({
  id: String(pick(i, 'id', 'incident_id') ?? '—'),
  title: pick(i, 'title', 'name') ?? 'Incident',
  severity: sev(pick(i, 'severity', 'risk')),
  status: title(pick(i, 'status'), 'Open'),
  users: pick(i, 'users', 'affected_users') ?? [],
  hosts: pick(i, 'hosts', 'affected_hosts') ?? [],
  ts: pick(i, 'first_seen', 'created_at', 'timestamp', 'ts') ?? null,
  lastSeen: pick(i, 'last_seen') ?? null,
  summary: pick(i, 'summary', 'description') ?? '',
  timeline: pick(i, 'chain', 'timeline') ?? [],
  events: pick(i, 'related_events', 'events') ?? [],
  alerts: pick(i, 'related_alerts', 'alerts') ?? [],
  risk: Number(pick(i, 'score', 'risk_score') ?? 0),
});

// ---- Hosts ----
// Backend: ComputerResponse { hostname, status, risk_score }
export const adaptHost = (h) => ({
  hostname: pick(h, 'hostname', 'name') ?? '—',
  ip: pick(h, 'ip', 'ip_address') ?? '—',
  os: pick(h, 'os', 'operating_system') ?? '—',
  status: title(pick(h, 'status'), 'Online'),
  ts: pick(h, 'last_seen', 'lastSeen', 'ts') ?? null,
  risk: Number(pick(h, 'risk_score', 'risk') ?? 0),
  events: Number(pick(h, 'event_count', 'events') ?? 0),
  role: pick(h, 'role') ?? '',
});

// ---- Rules ----
// Backend: RuleResponse { id, name, type, severity, logic, enabled, alert_count }
export const adaptRule = (r) => ({
  id: String(pick(r, 'id', 'rule_id') ?? '—'),
  name: pick(r, 'name', 'title') ?? 'Rule',
  eventId: pick(r, 'event_id', 'eventId') ?? '—',
  severity: sev(pick(r, 'severity')),
  type: pick(r, 'type') ?? '—',
  logic: pick(r, 'logic') ?? '',
  enabled: pick(r, 'enabled', 'is_enabled') ?? true,
  hits: Number(pick(r, 'alert_count', 'hits', 'hits_24h') ?? 0),
  mitre: pick(r, 'mitre', 'mitre_id') ?? '—',
  description: pick(r, 'description', 'logic') ?? '',
});

// ---- Users ----
// Backend: UserResponse { username, department, status, risk_score, baseline, recent_anomalies, recent_events, recent_alerts }
export const adaptUser = (u) => {
  const zeros = Array(24).fill(0);
  const baselineRaw = pick(u, 'baseline');
  const hourlyBaselineRaw = pick(u, 'hourly_baseline', 'hourlyBaseline');
  const hourlyTodayRaw = pick(u, 'hourly_today', 'hourlyToday');
  const baselineAvailable = !!baselineRaw && typeof baselineRaw === 'object' && Object.values(baselineRaw).some((v) => v != null && v !== '' && (!Array.isArray(v) || v.length > 0));
  const activityHistoryAvailable = Array.isArray(hourlyBaselineRaw) && Array.isArray(hourlyTodayRaw);
  const anomalyValue = pick(u, 'anomaly_score', 'anomaly');
  return {
    username: pick(u, 'username', 'name') ?? '—',
    display: pick(u, 'display_name', 'display') ?? pick(u, 'username', 'name') ?? '—',
    dept: pick(u, 'department', 'dept') ?? '—',
    status: pick(u, 'status') ?? 'Active',
    risk: Number(pick(u, 'risk_score', 'risk') ?? 0),
    anomaly: anomalyValue == null ? null : Number(anomalyValue),
    trend: pick(u, 'trend') ?? 'flat',
    ts: pick(u, 'last_seen', 'ts') ?? null,
    behavior: pick(u, 'behavior_type', 'behavior') ?? 'Not analyzed',
    baseline: baselineAvailable ? baselineRaw : { hours: null, computers: [], ips: [], loginsPerDay: null },
    baselineAvailable,
    activityHistoryAvailable,
    hourlyBaseline: activityHistoryAvailable ? hourlyBaselineRaw : zeros,
    hourlyToday: activityHistoryAvailable ? hourlyTodayRaw : zeros,
    riskTrend: pick(u, 'risk_trend', 'riskTrend') ?? [],
    knownComputers: pick(u, 'known_computers', 'knownComputers') ?? [],
    knownIps: pick(u, 'known_ips', 'knownIps') ?? [],
    anomalies: pick(u, 'recent_anomalies', 'anomalies') ?? [],
    events: pick(u, 'recent_events', 'events') ?? [],
    alerts: pick(u, 'recent_alerts', 'alerts') ?? [],
    what: pick(u, 'what_happened', 'what') ?? '',
    means: pick(u, 'what_it_means', 'means') ?? '',
    recommendation: pick(u, 'recommendation') ?? '',
  };
};
