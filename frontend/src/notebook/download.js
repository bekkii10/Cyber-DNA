import { MIME } from './exporters';
export function downloadText(filename, text, kind) {
  const blob = new Blob([text], { type: MIME[kind] || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copyToClipboard(text) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }
