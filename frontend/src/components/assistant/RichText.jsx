import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

// Safe renderer for API-generated text: output is only ever React text nodes (never HTML), so markup in the
// answer or in event data is displayed literally instead of executed.
export async function copyText(value) {
  try { await navigator.clipboard.writeText(value); return true; } catch { /* fall through to legacy path */ }
  try {
    const t = document.createElement('textarea');
    t.value = value; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  } catch { return false; }
}

export function useCopied() {
  const [done, setDone] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = async (v) => { if (await copyText(v)) { setDone(true); clearTimeout(timer.current); timer.current = setTimeout(() => setDone(false), 1500); } };
  return [done, run];
}

export function Copyable({ value, children }) {
  const [done, run] = useCopied();
  return (
    <button type="button" className="as-chip" onClick={() => run(value)} title={`Copy ${value}`} aria-label={`Copy ${value}`}>
      <span>{children ?? value}</span>
      {done ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
    </button>
  );
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const validIp = (s) => s.split('.').every((o) => Number(o) <= 255);
const wordChar = /[\w]/;

function inline(text, ids, keyBase) {
  const idPart = ids.length ? `|(${[...ids].sort((a, b) => b.length - a.length).map(esc).join('|')})` : '';
  const re = new RegExp(`(\`[^\`\\n]+\`)|(\\*\\*[^*\\n]+\\*\\*)|(\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b)${idPart}`, 'g');
  const out = []; let last = 0; let m; let n = 0;
  while ((m = re.exec(text))) {
    const [tok] = m;
    const before = text[m.index - 1]; const after = text[m.index + tok.length];
    const isId = m[4] !== undefined;
    const bounded = !isId || (!(before && wordChar.test(before)) && !(after && wordChar.test(after)));
    if (m[3] && !validIp(tok)) continue;
    if (!bounded) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${n += 1}`;
    if (m[1]) out.push(<Copyable key={k} value={tok.slice(1, -1)} />);
    else if (m[2]) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else out.push(<Copyable key={k} value={tok} />);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function CodeBlock({ code }) {
  const [done, run] = useCopied();
  return (
    <div className="as-code">
      <button type="button" className="as-code-copy" onClick={() => run(code)} aria-label="Copy code">{done ? <Check size={12} /> : <Copy size={12} />}{done ? 'Copied' : 'Copy'}</button>
      <pre><code>{code}</code></pre>
      <small>Suggested only. Cyber DNA never runs this for you.</small>
    </div>
  );
}

export default function RichText({ text, ids = [] }) {
  const blocks = []; const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = []; i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      i += 1; blocks.push({ t: 'code', v: buf.join('\n') });
    } else if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line); const items = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/).test(lines[i])) { items.push(lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/, '')); i += 1; }
      blocks.push({ t: ordered ? 'ol' : 'ul', v: items });
    } else if (!line.trim()) { i += 1; } else {
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^```/.test(lines[i]) && !/^\s*[-*•]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      blocks.push({ t: 'p', v: buf.join('\n') });
    }
  }
  return (
    <div className="as-rich">
      {blocks.map((b, k) => {
        if (b.t === 'code') return <CodeBlock key={k} code={b.v} />;
        if (b.t === 'p') return <p key={k}>{inline(b.v, ids, `p${k}`)}</p>;
        const L = b.t;
        return <L key={k}>{b.v.map((it, j) => <li key={j}>{inline(it, ids, `l${k}-${j}`)}</li>)}</L>;
      })}
    </div>
  );
}
