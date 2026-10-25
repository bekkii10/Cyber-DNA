import { escapeHtml } from './sanitize';
import { CHECKLISTS } from './securityKB';

export const utcNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
export const localNow = () => new Date().toLocaleString();
const cell = (v = '') => `<td>${escapeHtml(v)}</td>`;
const head = (cols) => `<tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
const table = (cols, rows = 1) => `<table><tbody>${head(cols)}${Array.from({ length: rows }, () => `<tr>${cols.map(() => cell()).join('')}</tr>`).join('')}</tbody></table><p></p>`;
export const tableHtml = table;
export const callout = (kind, text = '') => `<div data-callout="${kind}"><p>${escapeHtml(text)}</p></div>`;
export const taskList = (items) => `<ul data-type="taskList">${items.map((t) => `<li data-type="taskItem" data-checked="false"><p>${escapeHtml(t)}</p></li>`).join('')}</ul>`;
export const checklistHtml = (key) => `<h3>${escapeHtml(CHECKLISTS[key].title)}</h3>${taskList(CHECKLISTS[key].items)}`;

export const IOC_HEADERS = ['Type', 'Value', 'Context', 'Confidence', 'Source'];
export const SECURITY_BLOCKS = {
  evidence: { label: 'Evidence table', hint: 'Source, event ID, time (UTC), detail', html: () => table(['Source', 'Event ID', 'Time (UTC)', 'Detail'], 2) },
  timeline: { label: 'Timeline (UTC)', hint: 'Chronological attacker and defender actions', html: () => table(['Time (UTC)', 'Source', 'What happened', 'Evidence'], 3) },
  ioc: { label: 'Indicators (IOC) table', hint: 'Type, value, context, confidence, source', html: () => table(IOC_HEADERS, 2) },
  attack: { label: 'ATT&CK mapping', hint: 'Tactic, technique, ID, supporting evidence', html: () => table(['Tactic', 'Technique', 'ID', 'Supporting evidence'], 2) },
  custody: { label: 'Chain of custody', hint: 'Item, collected by, time (UTC), hash, location', html: () => table(['Item', 'Collected by', 'Time (UTC)', 'Hash', 'Stored at'], 1) },
  actions: { label: 'Response actions log', hint: 'Action, owner, status, time (UTC)', html: () => table(['Action', 'Owner', 'Status', 'Time (UTC)'], 2) },
  observation: { label: 'Observation', hint: 'Something directly seen in the data', html: () => callout('observation') },
  hypothesis: { label: 'Hypothesis', hint: 'Unconfirmed explanation to test', html: () => callout('hypothesis') },
  finding: { label: 'Finding (confirmed)', hint: 'Supported by evidence you can cite', html: () => callout('finding') },
  action: { label: 'Action item', hint: 'Something someone must do', html: () => callout('action') },
  warning: { label: 'Warning', hint: 'Risk or caveat the reader must see', html: () => callout('warning') },
  triageList: { label: 'Triage checklist', hint: 'Task list', html: () => checklistHtml('triage') },
  containmentList: { label: 'Containment checklist', hint: 'Recommendations only', html: () => checklistHtml('containment') },
  closureList: { label: 'Closure checklist', hint: 'Task list', html: () => checklistHtml('closure') },
};

const SKIP = new Set(['type']);
const nice = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const flat = (v) => (Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' ? (x.id || x.name || x.text || JSON.stringify(x)) : x)).join(', ') : v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}: ${x}`).join('; ') : v);

// Formatted evidence card for a record captured from the dashboard. Only fields present on the loaded record are listed.
export function evidenceCard(ctx, { source = 'Cyber DNA dashboard (loaded record)' } = {}) {
  const type = ctx?.type || 'item';
  const label = ctx?.id || ctx?.username || ctx?.hostname || ctx?.name || ctx?.eventId || type;
  const rows = Object.entries(ctx || {}).filter(([k, v]) => !SKIP.has(k) && v !== undefined && v !== null && v !== '').map(([k, v]) => `<tr><td>${escapeHtml(nice(k))}</td><td>${escapeHtml(flat(v))}</td></tr>`);
  return `<hr><h3>Captured ${escapeHtml(type)}: ${escapeHtml(label)}</h3><p>Captured at ${escapeHtml(utcNow())} from ${escapeHtml(source)}. This is the loaded record, not raw source events.</p><table><tbody>${head(['Field', 'Value'])}${rows.join('')}</tbody></table><p><em>Verify against source events before drawing conclusions.</em></p>`;
}
export const snippetCard = (text, source) => `<blockquote><p>${escapeHtml(text).replace(/\n/g, '<br>')}</p></blockquote><p><em>Captured ${escapeHtml(utcNow())} from ${escapeHtml(source || 'dashboard')}.</em></p>`;

// Convert plain AI text to HTML (paragraphs and bullet lists only), always escaped.
export function textToHtml(text) {
  const out = []; let list = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map((i) => `<li><p>${escapeHtml(i)}</p></li>`).join('')}</ul>`); list = []; } };
  String(text || '').split('\n').forEach((line) => {
    const m = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (m) list.push(m[1]); else { flush(); if (line.trim()) out.push(`<p>${escapeHtml(line.trim())}</p>`); }
  });
  flush();
  return out.join('');
}
// AI-generated content is always inserted inside a labelled callout so it is never mistaken for analyst-verified fact.
export const aiBlock = (text, { question } = {}) => `<div data-callout="ai"><p><strong>AI draft, verify before use</strong> (${escapeHtml(utcNow())})</p>${question ? `<p><em>Question: ${escapeHtml(question)}</em></p>` : ''}${textToHtml(text)}</div>`;
