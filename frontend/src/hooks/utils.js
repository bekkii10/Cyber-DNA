export const timeAgo = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};
export const fmtTime = (iso) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
export const fmtNum = (n) => Number(n).toLocaleString();
export const riskLevel = (r) => (r >= 85 ? 'critical' : r >= 70 ? 'high' : r >= 50 ? 'medium' : r >= 30 ? 'low' : 'ok');
export const riskLabel = (r) => ({ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', ok: 'Normal' }[riskLevel(r)]);
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const initials = (name) => name.split(/[\s._]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
