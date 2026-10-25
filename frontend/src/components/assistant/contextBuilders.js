// Build the smallest useful context object for the entity the analyst is looking at.
// Values are truncated and empty/placeholder fields are dropped. Nothing is invented: missing data stays missing.
const MAX = { text: 600, items: 25 };
const empty = (v) => v === undefined || v === null || v === '' || v === '—' || (Array.isArray(v) && !v.length);
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !empty(v)));
const trunc = (s, n = MAX.text) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n)}…` : s);
const first = (a, n = MAX.items) => (Array.isArray(a) ? a.slice(0, n) : []);

export const alertContext = (a) => clean({
  type: 'alert', id: a.id, title: a.title, severity: a.severity, status: a.status, rule: a.rule, eventId: a.eventId,
  user: a.user, host: a.host, sourceIp: a.ip, time: a.ts, riskScore: a.score, source: a.source,
  description: trunc(a.description), storedExplanation: trunc(a.explanation, 800),
});

export const userContext = (u) => clean({
  type: 'user', username: u.username, department: u.dept, status: u.status, riskScore: u.risk, anomalyScore: u.anomaly, behavior: u.behavior, lastSeen: u.ts,
  baseline: clean({ hours: u.baseline?.hours, loginsPerDay: u.baseline?.loginsPerDay, computers: u.baseline?.computers, ips: u.baseline?.ips }),
  newComputers: first(u.knownComputers).filter((c) => c.isNew).map((c) => c.name),
  newSourceIps: first(u.knownIps).filter((c) => c.isNew).map((c) => c.name),
  recentAnomalies: first(u.anomalies, 5).map((x) => clean({ severity: x.severity, text: trunc(x.text, 300), time: x.ts })),
  storedAnalysis: clean({ whatHappened: trunc(u.what), whatItMeans: trunc(u.means), recommendation: trunc(u.recommendation) }),
});

export const incidentContext = (i) => clean({
  type: 'incident', id: i.id, title: i.title, severity: i.severity, status: i.status, riskScore: i.risk, users: first(i.users), hosts: first(i.hosts),
  firstSeen: i.ts, lastSeen: i.lastSeen, summary: trunc(i.summary),
  timeline: first(i.timeline).map((t) => clean({ time: t.t, text: trunc(t.text, 300) })),
  relatedEvents: first(i.events).map((e) => clean({ id: e.id, eventId: e.eventId, description: trunc(e.desc, 300), time: e.ts })),
  relatedEventsTotal: Array.isArray(i.events) ? i.events.length : undefined,
  relatedAlertIds: first(i.alerts).map((a) => (a && typeof a === 'object' ? a.id : a)),
});

// Identifiers worth making copyable when they appear in an answer (taken from the context only, never guessed).
export function identifiersOf(sel) {
  if (!sel) return [];
  const out = new Set();
  const add = (v) => { if (typeof v === 'string' || typeof v === 'number') { const s = String(v); if (s.length >= 3) out.add(s); } };
  ['id', 'eventId', 'user', 'username', 'host', 'sourceIp'].forEach((k) => add(sel[k]));
  [...(sel.users || []), ...(sel.hosts || []), ...(sel.relatedAlertIds || [])].forEach(add);
  (sel.relatedEvents || []).forEach((e) => { add(e.id); add(e.eventId); });
  return [...out];
}

export const suggestionsFor = (type) => ({
  alert: ['Explain this alert in simple terms', 'What evidence supports this detection?', 'What should I investigate next?'],
  user: ["Explain this user's unusual activity", "Compare this activity with the user's recent behavior", 'Explain the risk score'],
  incident: ['Show the sequence of events that led to this incident', 'What is the safest recommended response?', 'What should I investigate next?'],
}[type] || ['How should I triage a new critical alert?', 'What does a risk score of 85 or higher mean?', 'Which Active Directory events matter most for privilege escalation?']);
