// Allowlist HTML sanitizer for notes. Notes are untrusted input (browser storage, imports, AI output, dashboard data),
// so only structural tags and a few known attributes survive. Everything else is unwrapped or removed.
const ALLOWED = new Set(['P', 'BR', 'H1', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'MARK', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'A', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'HR', 'DIV']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT']);
export const CALLOUT_KINDS = ['observation', 'hypothesis', 'finding', 'action', 'warning', 'ai'];

function keepAttrs(el) {
  const tag = el.tagName;
  [...el.attributes].forEach((attr) => {
    const { name, value } = attr;
    const ok =
      (tag === 'A' && name === 'href' && /^(https?:|mailto:)/i.test(value.trim())) ||
      (tag === 'UL' && name === 'data-type' && value === 'taskList') ||
      (tag === 'LI' && name === 'data-type' && value === 'taskItem') ||
      (tag === 'LI' && name === 'data-checked' && (value === 'true' || value === 'false')) ||
      (tag === 'DIV' && name === 'data-callout' && CALLOUT_KINDS.includes(value)) ||
      ((tag === 'TD' || tag === 'TH') && (name === 'colspan' || name === 'rowspan') && /^\d{1,2}$/.test(value));
    if (!ok) el.removeAttribute(name);
  });
  if (tag === 'A') { el.setAttribute('rel', 'noopener noreferrer'); el.setAttribute('target', '_blank'); }
}

export function cleanHtml(input) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(String(input || ''), 'text/html');
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (DROP.has(child.tagName)) { child.remove(); return; }
        const isCallout = child.tagName === 'DIV' && CALLOUT_KINDS.includes(child.getAttribute('data-callout'));
        if (!ALLOWED.has(child.tagName) || (child.tagName === 'DIV' && !isCallout)) { walk(child); child.replaceWith(...child.childNodes); return; }
        keepAttrs(child);
        walk(child);
      } else if (child.nodeType !== Node.TEXT_NODE) child.remove();
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(cleanHtml(html), 'text/html');
  const out = [];
  const block = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'PRE', 'TR', 'DIV', 'HR']);
  const walk = (n) => {
    if (n.nodeType === Node.TEXT_NODE) { out.push(n.textContent); return; }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    if (n.tagName === 'BR') { out.push('\n'); return; }
    if (n.tagName === 'TD' || n.tagName === 'TH') { [...n.childNodes].forEach(walk); out.push('\t'); return; }
    [...n.childNodes].forEach(walk);
    if (block.has(n.tagName)) out.push('\n');
  };
  walk(doc.body);
  return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
