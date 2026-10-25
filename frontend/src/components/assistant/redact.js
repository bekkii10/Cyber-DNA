// Client-side pseudonymization. Identifiers are swapped for stable placeholders (IP-1, USER-1, HOST-1) before the
// request leaves the browser, and swapped back in the answer so the analyst reads real values.
// Limits: it only knows identifiers present in the context plus IPv4 patterns; free-text names it cannot recognise are NOT masked.
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function collect(payload) {
  const found = { IP: new Set(), USER: new Set(), HOST: new Set() };
  const sel = payload.context?.selection || {};
  [sel.user, sel.username, ...(sel.users || [])].forEach((v) => typeof v === 'string' && v.length > 1 && found.USER.add(v));
  [sel.host, sel.hostname, ...(sel.hosts || [])].forEach((v) => typeof v === 'string' && v.length > 1 && found.HOST.add(v));
  [sel.sourceIp, sel.ip].forEach((v) => typeof v === 'string' && found.IP.add(v));
  const strings = [];
  const walk = (v) => { if (typeof v === 'string') strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(payload.message); walk(payload.history); walk(payload.context);
  strings.forEach((s) => (s.match(IPV4) || []).forEach((ip) => found.IP.add(ip)));
  return found;
}

export function createRedactor(payload) {
  const found = collect(payload);
  const map = new Map(); // original -> token
  const back = new Map(); // token -> original
  Object.entries(found).forEach(([kind, set]) => [...set].sort((a, b) => b.length - a.length).forEach((value) => {
    const key = kind === 'IP' ? value : value.toLowerCase();
    if (map.has(key)) return;
    const token = `${kind}-${[...map.values()].filter((t) => t.startsWith(kind)).length + 1}`;
    map.set(key, token); back.set(token, value);
  }));
  const entries = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
  const mask = (s) => entries.reduce((out, [orig, token]) => out.replace(new RegExp(`(^|[^\\w.-])${esc(orig)}(?![\\w-])`, 'gi'), `$1${token}`), s);
  const deep = (v) => (typeof v === 'string' ? mask(v) : Array.isArray(v) ? v.map(deep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : v);
  const restore = (s) => (typeof s === 'string' ? s.replace(/\b(?:IP|USER|HOST)-\d+\b/g, (t) => back.get(t) ?? t) : s);
  return { redacted: deep(payload), restore, count: map.size };
}
