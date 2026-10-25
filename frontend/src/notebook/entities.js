// Local indicator extraction. Nothing here is sent anywhere. Patterns are deliberately conservative:
// results are *candidates* the analyst must confirm, not verdicts.
const octet = '(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)';
const RULES = [
  ['url', /\b(?:https?|hxxps?):\/\/[^\s<>"')\]]+/gi],
  ['email', /\b[\w.+-]+(?:@|\[@\])[\w-]+(?:(?:\.|\[\.\])[\w-]+)+\b/g],
  ['ipv4', new RegExp(`\\b${octet}(?:(?:\\.|\\[\\.\\])${octet}){3}\\b`, 'g')],
  ['hash', /\b(?:[a-fA-F0-9]{64}|[a-fA-F0-9]{40}|[a-fA-F0-9]{32})\b/g],
  ['cve', /\bCVE-\d{4}-\d{4,7}\b/gi],
  ['technique', /\bT\d{4}(?:\.\d{3})?\b/g],
  ['sid', /\bS-1-5-21(?:-\d+){3,4}\b/g],
  ['eventId', /\bEvent(?:\s*ID)?[:\s#]*(\d{3,5})\b/gi],
];
export const ENTITY_LABEL = { url: 'URL', email: 'Email', ipv4: 'IPv4 address', hash: 'File hash', cve: 'CVE', technique: 'ATT&CK technique', sid: 'Windows SID', eventId: 'Windows event ID' };
export const hashKind = (v) => ({ 64: 'SHA-256', 40: 'SHA-1', 32: 'MD5' }[v.length] || 'hash');
export const refang = (v) => String(v).replace(/hxxp/gi, 'http').replace(/\[\.\]/g, '.').replace(/\[@\]/g, '@');
export const defang = (v, type) => {
  const s = refang(v);
  if (type === 'url') return s.replace(/^http/i, 'hxxp').replace(/\./g, '[.]');
  if (type === 'ipv4') return s.replace(/\./g, '[.]');
  if (type === 'email') return s.replace('@', '[@]').replace(/\./g, '[.]');
  return v;
};
export const isPrivateIp = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.)/.test(refang(ip));

export function extractEntities(text) {
  const found = new Map();
  const taken = [];
  const text0 = String(text || '');
  RULES.forEach(([type, re]) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text0))) {
      const start = m.index; const end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue; // a URL already claimed this span (its host, etc.)
      taken.push([start, end]);
      const value = type === 'eventId' ? m[1] : m[0];
      const norm = type === 'hash' ? value.toLowerCase() : type === 'cve' ? value.toUpperCase() : type === 'url' || type === 'ipv4' || type === 'email' ? refang(value) : value;
      const key = `${type}:${norm}`;
      const prev = found.get(key);
      if (prev) prev.count += 1;
      else found.set(key, { type, value: norm, count: 1, subtype: type === 'hash' ? hashKind(norm) : type === 'ipv4' ? (isPrivateIp(norm) ? 'private' : 'public') : undefined });
    }
  });
  return [...found.values()];
}

// Classify a short selection (for the "Add as IOC" quick action). Returns null if it is not a single clear indicator.
export function classifySingle(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 300 || /\s/.test(t)) return null;
  const hits = extractEntities(t);
  if (hits.length !== 1) return null;
  const h = hits[0];
  if (h.type === 'eventId' || h.type === 'technique' || h.type === 'cve') return null;
  const whole = h.type === 'url' || h.type === 'email' ? refang(t) === h.value : t === h.value || refang(t) === h.value;
  return whole ? h : null;
}
