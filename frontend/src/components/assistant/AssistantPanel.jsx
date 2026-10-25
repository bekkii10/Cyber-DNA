import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, BookmarkPlus, BrainCircuit, Check, ChevronRight, Copy, Eye, Grip, Maximize2, Minimize2, Move, NotebookPen, Paperclip, RefreshCw, RotateCw, Settings2, ShieldCheck, Sparkles, SquarePen, TriangleAlert, X } from 'lucide-react';
import { useAssistant } from './AssistantProvider';
import RichText, { useCopied } from './RichText';
import AssistantSettings from './AssistantSettings';
import { useAiSettings } from './assistantSettings';
import { suggestionsFor } from './contextBuilders';
import useFloatingWindow from '../../hooks/useFloatingWindow';
import { noteForAi } from './AssistantProvider';
import { useStore } from '../../lib/createStore';
import { store as noteStore, notebook } from '../../notebook/notebookStore';
import { aiBlock } from '../../notebook/blocks';

const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const KIND = { confirmed: ['sev-ok', 'Confirmed'], suspicious: ['sev-high', 'Suspicious'], hypothesis: ['sev-info', 'Hypothesis'] };
const MAX_LEN = 2000;
// Prompt library, opened by typing "/" in the composer (same idea as Notion's slash menu).
const PROMPTS = [
  ['explain', 'Explain in simple terms', 'Explain this in simple terms.'],
  ['evidence', 'List the evidence', 'What evidence supports this detection? Separate confirmed facts, suspicious indicators and hypotheses.'],
  ['next', 'What to investigate next', 'What should I investigate next?'],
  ['baseline', 'Compare with baseline', "Compare this activity with the user's recent behavior."],
  ['risk', 'Explain the risk score', 'Explain the risk score.'],
  ['response', 'Safest response', 'What is the safest recommended response? Recommendations only; do not assume anything was executed.'],
  ['timeline', 'Build a UTC timeline', 'Build a timeline of the events using only timestamps present in the data. Mark gaps instead of guessing.'],
  ['summary', 'Executive summary', 'Write a short executive summary for a non-technical manager.'],
];

function Sections({ s, ids }) {
  return (
    <div className="as-sections">
      {s.summary && <section><h4>Summary</h4><RichText text={s.summary} ids={ids} /></section>}
      {s.evidence.length > 0 && (
        <details className="as-evidence" open={s.evidence.length <= 3}>
          <summary><ChevronRight size={14} aria-hidden="true" />Evidence <span className="muted">({s.evidence.length})</span></summary>
          <ul>{s.evidence.map((e, i) => <li key={i}>{e.kind && <span className={`badge ${KIND[e.kind][0]}`}>{KIND[e.kind][1]}</span>}<RichText text={e.text} ids={ids} /></li>)}</ul>
        </details>
      )}
      {s.risk && <section><h4>Risk</h4><RichText text={s.risk} ids={ids} /></section>}
      {s.next_steps.length > 0 && <section><h4>Next steps</h4><ol>{s.next_steps.map((n, i) => <li key={i}><RichText text={n} ids={ids} /></li>)}</ol></section>}
    </div>
  );
}

function AssistantMessage({ m, question, last, onRegenerate, pending, showTime }) {
  const [done, run] = useCopied();
  const [saved, setSaved] = useState(false);
  const save = () => { notebook.appendHtml(aiBlock(m.content, { question })); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  return (
    <div className="as-msg as-ai">
      <div className="as-meta"><b>AI Analyst</b>{showTime && <time dateTime={new Date(m.ts).toISOString()}>{clock(m.ts)}</time>}
        <span className="as-actions">
          <button type="button" className="as-mini" onClick={() => run(m.content)} aria-label="Copy answer" title="Copy answer">{done ? <Check size={13} /> : <Copy size={13} />}</button>
          <button type="button" className="as-mini" onClick={save} aria-label="Save to Notebook" title="Save to Notebook (labelled as an AI draft)">{saved ? <Check size={13} /> : <BookmarkPlus size={13} />}</button>
          {last && <button type="button" className="as-mini" onClick={onRegenerate} disabled={pending} aria-label="Regenerate answer" title="Regenerate answer"><RefreshCw size={13} /></button>}
        </span>
      </div>
      {m.sections ? <Sections s={m.sections} ids={m.ids} /> : <RichText text={m.content} ids={m.ids} />}
    </div>
  );
}

function UserMessage({ m, onRetry, pending, showTime }) {
  return (
    <div className="as-msg as-user">
      <div className="as-bubble">{m.content}</div>
      {m.status === 'failed' && (
        <div className="as-error" role="alert">
          <TriangleAlert size={15} aria-hidden="true" />
          <span>{m.error?.message || 'The request failed.'}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRetry(m.id)} disabled={pending}><RotateCw size={13} />Retry</button>
        </div>
      )}
      {m.sent && (
        <details className="as-sent">
          <summary><Eye size={12} aria-hidden="true" />What was sent{m.sent.redactions ? ` · ${m.sent.redactions} masked` : ''}</summary>
          <pre>{JSON.stringify({ context: m.sent.context ?? null, options: m.sent.options }, null, 2)}</pre>
        </details>
      )}
      {showTime && <time className="as-time" dateTime={new Date(m.ts).toISOString()}>{clock(m.ts)}</time>}
    </div>
  );
}

export default function AssistantPanel() {
  const a = useAssistant();
  return a ? <Panel a={a} /> : null;
}

function Panel({ a }) {
  const [draft, setDraft] = useState('');
  const [slashIdx, setSlashIdx] = useState(0);
  const list = useRef(null); const input = useRef(null); const launcher = useRef(null); const wasOpen = useRef(false);
  const floating = useFloatingWindow('cyberdna-ai-window', 320, 360);
  const settings = useAiSettings();
  const { open, wide, setWide, messages, pending, context, includeCtx, setIncludeCtx, excerpt, setExcerpt, noteOn, setNoteOn, seed, settingsOpen, setSettingsOpen, send, retry, cancel, regenerate, newConversation, toggle, close } = a;
  const activeNote = useStore(noteStore, (s) => s.notes.find((n) => n.id === s.activeId));
  const noteState = useMemo(() => noteForAi(), [activeNote, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const noteEffective = noteOn || settings.includeNote;
  const sel = context.selection;
  const label = sel ? `${({ alert: 'Alert', user: 'User', incident: 'Incident', host: 'Host', rule: 'Rule', event: 'Event' })[sel.type] || 'Item'} ${sel.id || sel.username || sel.hostname || sel.name || ''}`.trim() : context.page;
  const filterCount = context.filters ? Object.keys(context.filters).length : 0;
  const toggleWide = () => { const next = !wide; setWide(next); floating.resizeTo(next ? 720 : 416, floating.rect.height); };

  useEffect(() => {
    if (open) { input.current?.focus(); floating.bringToFront(); } else if (wasOpen.current) launcher.current?.focus();
    wasOpen.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (seed) { setDraft(seed.text); setTimeout(() => input.current?.focus(), 0); } }, [seed?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, pending, open]);
  useLayoutEffect(() => { const el = input.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 150)}px`; }, [draft, open]);

  const slash = /^\/(\w*)$/.exec(draft);
  const slashItems = slash ? PROMPTS.filter(([id, title]) => `${id} ${title}`.toLowerCase().includes(slash[1].toLowerCase())) : [];
  const pickPrompt = (p) => { setDraft(p[2]); setSlashIdx(0); input.current?.focus(); };

  const submit = async (text = draft) => {
    if (!text.trim() || pending) return;
    setDraft('');
    await send(text);
    input.current?.focus();
  };
  const onKey = (e) => {
    if (slash && slashItems.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIdx((i) => (i + 1) % slashItems.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIdx((i) => (i + slashItems.length - 1) % slashItems.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickPrompt(slashItems[Math.min(slashIdx, slashItems.length - 1)]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDraft(''); return; }
    }
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      const send_ = settings.sendKey === 'enter' ? !e.shiftKey : (e.ctrlKey || e.metaKey);
      if (send_) { e.preventDefault(); submit(); }
    }
  };
  const onPanelKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (settingsOpen) setSettingsOpen(false); else close(); } };

  const suggestions = suggestionsFor(sel?.type);
  const lastFailed = messages.length && messages[messages.length - 1].status === 'failed';
  const lastAi = [...messages].reverse().find((m) => m.role === 'assistant');
  const questionFor = (m) => { const i = messages.indexOf(m); for (let k = i - 1; k >= 0; k -= 1) if (messages[k].role === 'user') return messages[k].content; return ''; };

  return (
    <div className={`as-root ${open ? 'is-open' : ''} ${wide ? 'is-wide' : ''} ${settings.compact ? 'is-compact' : ''}`}>
      <div className="as-launch-wrap">
        <button ref={launcher} type="button" className="as-launcher" onClick={toggle} aria-expanded={open} aria-controls="ai-analyst-panel" aria-describedby="ai-analyst-tip" aria-keyshortcuts="Alt+A" aria-label={open ? 'Close AI Analyst' : 'Open AI Analyst'}>
          {open ? <X size={18} aria-hidden="true" /> : <span className="as-launch-art" aria-hidden="true"><BrainCircuit className="as-launch-brain" size={21} strokeWidth={1.8} /><Sparkles className="as-launch-spark" size={10} strokeWidth={2} /><i className="as-launch-orbit" /></span>}
        </button>
        <span id="ai-analyst-tip" role="tooltip" className="as-tip">AI Analyst <kbd>Alt A</kbd></span>
      </div>

      <aside id="ai-analyst-panel" className="as-panel as-floating-window" style={{ ...floating.style, right: 'auto', bottom: 'auto' }} role="complementary" aria-label="AI Analyst" hidden={!open} onKeyDown={onPanelKey} onPointerDownCapture={floating.bringToFront}>
        <header className="as-head as-drag-handle" onPointerDown={floating.onDragStart} onKeyDown={floating.onKeyDown} onDoubleClick={(e) => { if (!e.target.closest('button')) toggleWide(); }} tabIndex={0} aria-label="AI Analyst window. Alt plus arrow keys move it; Alt plus Shift plus arrows resize it." title="Drag to move. Double-click to expand or shrink.">
          <Move size={13} className="as-drag-mark" aria-hidden="true" />
          <div className="as-title"><b>AI Analyst</b><small>Investigative aid. Verify against the source events.</small></div>
          <div className="as-head-actions">
            <button type="button" className="as-icon" onClick={newConversation} disabled={!messages.length} aria-label="New conversation" title="New conversation"><SquarePen size={16} /></button>
            <button type="button" className="as-icon" onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen} aria-label="AI Analyst settings" title="Settings"><Settings2 size={16} /></button>
            <button type="button" className="as-icon as-expand" onClick={toggleWide} aria-pressed={wide} aria-label={wide ? 'Compact panel' : 'Expand panel'} title={wide ? 'Compact panel' : 'Expand panel'}>{wide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
            <button type="button" className="as-icon" onClick={close} aria-label="Close AI Analyst" title="Close (Esc)"><X size={17} /></button>
          </div>
        </header>
        {settingsOpen && <AssistantSettings floating={floating} onClose={() => setSettingsOpen(false)} />}

        <div className="as-chips" aria-label="Context that will be sent with your next question">
          <span className={`as-chip-ctx ${includeCtx ? '' : 'is-off'}`} title={includeCtx ? 'Sent with each question: current page, search text, filters and the selected item summary.' : 'Page context is not being sent.'}>
            <Paperclip size={12} aria-hidden="true" />
            <span className="as-chip-label">{includeCtx ? `${label}${filterCount ? ` · ${filterCount} filter${filterCount > 1 ? 's' : ''}` : ''}${context.search ? ' · search' : ''}` : 'No page context'}</span>
            <button type="button" className="as-chip-x" onClick={() => setIncludeCtx(!includeCtx)} aria-pressed={includeCtx} aria-label={includeCtx ? 'Remove page context' : 'Attach page context'}>{includeCtx ? <X size={12} /> : <span>Attach</span>}</button>
          </span>
          {excerpt && <span className="as-chip-ctx" title={excerpt.text}><span className="as-chip-label">“{excerpt.text.slice(0, 36)}{excerpt.text.length > 36 ? '…' : ''}”</span><button type="button" className="as-chip-x" onClick={() => setExcerpt(null)} aria-label="Remove selected text"><X size={12} /></button></span>}
          <button type="button" className={`as-chip-ctx as-chip-toggle ${noteEffective && !noteState.blocked ? '' : 'is-off'}`} onClick={() => setNoteOn(!noteOn)} aria-pressed={noteEffective && !noteState.blocked} disabled={!!noteState.blocked && !noteEffective} title={noteState.blocked ? noteState.blocked : 'Include an excerpt of the open Notebook note'}>
            <NotebookPen size={12} aria-hidden="true" /><span className="as-chip-label">{noteState.blocked && noteEffective ? 'Note blocked: TLP:RED' : noteEffective ? 'Open note attached' : 'Attach open note'}</span>
          </button>
          {settings.redact && <button type="button" className="as-chip-ctx as-chip-toggle" onClick={() => setSettingsOpen(true)} title="IPs, users and hosts are masked before sending"><ShieldCheck size={12} aria-hidden="true" /><span className="as-chip-label">Masking on</span></button>}
        </div>

        <div className="as-list" ref={list} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
          {messages.length === 0 ? (
            <div className="as-empty">
              <h3>{sel ? `Ask about ${label}` : 'Ask about your environment'}</h3>
              <p>{sel ? 'Questions use the item you have open. Answers come from the Cyber DNA analysis service.' : 'Open an alert, user or incident to ask about it directly, or ask a general question.'}</p>
              <ul>{suggestions.map((s) => <li key={s}><button type="button" onClick={() => submit(s)} disabled={pending}>{s}</button></li>)}</ul>
              <p className="as-tip-line">Tip: select any text on the page and choose <b>Ask AI</b>, or type <kbd>/</kbd> for saved prompts.</p>
            </div>
          ) : messages.map((m) => (m.role === 'user'
            ? <UserMessage key={m.id} m={m} onRetry={retry} pending={pending} showTime={settings.showTimestamps} />
            : <AssistantMessage key={m.id} m={m} question={questionFor(m)} last={m === lastAi && messages[messages.length - 1] === m} onRegenerate={regenerate} pending={pending} showTime={settings.showTimestamps} />))}
          {pending && <div className="as-msg as-ai" role="status"><div className="as-typing"><i /><i /><i /><span>Analyzing…</span><button type="button" className="as-link" onClick={cancel}>Cancel</button></div></div>}
        </div>

        <footer className="as-foot">
          {slash && slashItems.length > 0 && (
            <ul className="as-slash" role="listbox" aria-label="Saved prompts">
              {slashItems.map((p, i) => <li key={p[0]}><button type="button" role="option" aria-selected={i === slashIdx} className={i === slashIdx ? 'on' : ''} onMouseEnter={() => setSlashIdx(i)} onClick={() => pickPrompt(p)}><b>/{p[0]}</b><span>{p[1]}</span></button></li>)}
            </ul>
          )}
          <div className="as-composer">
            <textarea ref={input} value={draft} onChange={(e) => { setDraft(e.target.value.slice(0, MAX_LEN)); setSlashIdx(0); }} onKeyDown={onKey} rows={1} placeholder={lastFailed ? 'Retry above or ask something else' : 'Ask anything, or type / for prompts'} aria-label="Message to AI Analyst" />
            <button type="button" className="as-send" onClick={() => submit()} disabled={pending || !draft.trim()} aria-label="Send message"><ArrowUp size={17} /></button>
          </div>
          <p className="as-hint">{settings.sendKey === 'enter' ? 'Enter to send · Shift+Enter for a new line' : 'Ctrl/⌘+Enter to send · Enter for a new line'}. The assistant only suggests actions and never runs them. Conversations clear on reload.</p>
        </footer>
        <button type="button" className="floating-resize-handle" onPointerDown={floating.onResizeStart} aria-label="Resize AI Analyst panel" title="Drag to resize"><Grip size={15} /></button>
      </aside>
    </div>
  );
}
