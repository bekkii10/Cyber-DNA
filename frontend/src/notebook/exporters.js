import { cleanHtml, escapeHtml, htmlToText } from './sanitize';
import { defang, extractEntities } from './entities';
import { tlpOf } from './securityKB';

const mdEscapeCell = (s) => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

// DOM -> Markdown. Works on any stored note without needing an editor instance.
export function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(cleanHtml(html), 'text/html');
  const inline = (n) => [...n.childNodes].map((c) => {
    if (c.nodeType === Node.TEXT_NODE) return c.textContent;
    if (c.nodeType !== Node.ELEMENT_NODE) return '';
    const t = c.tagName; const inner = inline(c);
    if (t === 'STRONG' || t === 'B') return `**${inner}**`;
    if (t === 'EM' || t === 'I') return `*${inner}*`;
    if (t === 'S') return `~~${inner}~~`;
    if (t === 'MARK') return `==${inner}==`;
    if (t === 'CODE') return `\`${inner}\``;
    if (t === 'BR') return '  \n';
    if (t === 'A') return `[${inner}](${c.getAttribute('href') || ''})`;
    return inner;
  }).join('');
  const list = (el, depth) => [...el.children].filter((li) => li.tagName === 'LI').map((li, i) => {
    const task = li.getAttribute('data-type') === 'taskItem';
    const mark = task ? `- [${li.getAttribute('data-checked') === 'true' ? 'x' : ' '}] ` : el.tagName === 'OL' ? `${i + 1}. ` : '- ';
    const own = [...li.children].filter((c) => !['UL', 'OL'].includes(c.tagName)).map((c) => blockText(c)).join(' ').trim() || inline(li).trim();
    const nested = [...li.children].filter((c) => ['UL', 'OL'].includes(c.tagName)).map((c) => `\n${list(c, depth + 1)}`).join('');
    return `${'  '.repeat(depth)}${mark}${own}${nested}`;
  }).join('\n');
  const blockText = (el) => [...el.childNodes].map((c) => (c.nodeType === Node.TEXT_NODE ? c.textContent : inline({ childNodes: [c] }))).join('').trim();
  const block = (el) => {
    const t = el.tagName;
    if (/^H[1-4]$/.test(t)) return `${'#'.repeat(Number(t[1]))} ${inline(el).trim()}\n\n`;
    if (t === 'P') { const s = inline(el).trim(); return s ? `${s}\n\n` : ''; }
    if (t === 'UL' || t === 'OL') return `${list(el, 0)}\n\n`;
    if (t === 'BLOCKQUOTE') return `${[...el.children].map((c) => block(c).trim()).join('\n\n').split('\n').map((l) => `> ${l}`).join('\n')}\n\n`;
    if (t === 'PRE') return `\`\`\`\n${el.textContent.replace(/\n$/, '')}\n\`\`\`\n\n`;
    if (t === 'HR') return '---\n\n';
    if (t === 'DIV' && el.hasAttribute('data-callout')) {
      const kind = el.getAttribute('data-callout');
      const label = { observation: 'Observation', hypothesis: 'Hypothesis (unconfirmed)', finding: 'Finding', action: 'Action', warning: 'Warning', ai: 'AI draft, verify before use' }[kind];
      return `${[...el.children].map((c, i) => (i === 0 ? `**${label}:** ${block(c).trim()}` : block(c).trim())).join('\n\n').split('\n').map((l) => `> ${l}`).join('\n')}\n\n`;
    }
    if (t === 'TABLE') {
      const rows = [...el.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => mdEscapeCell(c.textContent || '')));
      if (!rows.length) return '';
      const width = Math.max(...rows.map((r) => r.length));
      const pad = (r) => [...r, ...Array(width - r.length).fill('')];
      return `| ${pad(rows[0]).join(' | ')} |\n| ${Array(width).fill('---').join(' | ')} |\n${rows.slice(1).map((r) => `| ${pad(r).join(' | ')} |`).join('\n')}\n\n`;
    }
    return [...el.children].map(block).join('') || `${inline(el).trim()}\n\n`;
  };
  return [...doc.body.children].map(block).join('').replace(/\n{3,}/g, '\n\n').trim();
}

export const tlpLine = (note) => `${tlpOf(note.tlp).label}${note.caseRef ? ` | Case ${note.caseRef}` : ''}${note.tags?.length ? ` | ${note.tags.map((t) => `#${t}`).join(' ')}` : ''}`;

function maybeDefang(text, on) {
  if (!on) return text;
  let out = text;
  extractEntities(text).filter((e) => ['ipv4', 'url', 'email'].includes(e.type)).sort((a, b) => b.value.length - a.value.length).forEach((e) => { out = out.split(e.value).join(defang(e.value, e.type)); });
  return out;
}

export function exportNote(note, format, { defangIocs = false, banner = true } = {}) {
  const head = banner ? `${tlpLine(note)}\n\n` : '';
  if (format === 'md') return maybeDefang(`${head}# ${note.title}\n\n${htmlToMarkdown(note.html)}\n`, defangIocs);
  if (format === 'txt') return maybeDefang(`${head}${note.title}\n${'='.repeat(note.title.length)}\n\n${htmlToText(note.html)}\n`, defangIocs);
  const bannerHtml = banner ? `<div class="tlp tlp-${escapeHtml(note.tlp)}">${escapeHtml(tlpLine(note))}</div>` : '';
  const css = 'body{font:16px/1.65 system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 24px;color:#172033}h1{border-bottom:1px solid #ddd;padding-bottom:10px}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #cbd2dc;padding:6px 9px;text-align:left;vertical-align:top}th{background:#f1f4f8}blockquote{margin:12px 0;padding:2px 14px;border-left:3px solid #9aa5b5;color:#3b475a}pre{background:#f1f4f8;padding:12px;overflow:auto;border-radius:6px}[data-callout]{margin:12px 0;padding:8px 14px;border-left:4px solid #6b7a90;background:#f6f8fb}[data-callout=hypothesis]{border-color:#b7791f}[data-callout=finding]{border-color:#2f855a}[data-callout=warning]{border-color:#c53030}.tlp{display:inline-block;background:#000;color:#fff;font:700 12px monospace;padding:3px 9px;border-radius:3px}@media print{body{margin:0}}';
  return `<!doctype html><meta charset="utf-8"><title>${escapeHtml(note.title)}</title><style>${css}</style>${bannerHtml}<h1>${escapeHtml(note.title)}</h1>${maybeDefang(cleanHtml(note.html), defangIocs)}`;
}

export const MIME = { md: 'text/markdown;charset=utf-8', txt: 'text/plain;charset=utf-8', html: 'text/html;charset=utf-8', json: 'application/json', csv: 'text/csv;charset=utf-8' };
export const safeFile = (s) => (s || 'security-note').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'security-note';

export function iocCsv(entities, { defangIocs = true } = {}) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  // Neutralize spreadsheet formula injection from untrusted note text.
  const safe = (v) => (/^[=+\-@\t\r]/.test(String(v)) ? `'${v}` : v);
  const rows = entities.map((e) => [e.type, e.subtype || '', defangIocs ? defang(e.value, e.type) : e.value, e.count].map((c) => q(safe(c))).join(','));
  return ['type,subtype,value,occurrences', ...rows].join('\n');
}

export const backupJson = (notes) => JSON.stringify({ app: 'cyber-dna-notebook', version: 2, exportedAt: new Date().toISOString(), notes }, null, 2);
