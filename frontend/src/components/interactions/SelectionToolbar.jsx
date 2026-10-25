import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Crosshair, NotebookPen, Sparkles } from 'lucide-react';
import { useAssistant } from '../assistant/AssistantProvider';
import { useAiSettings } from '../assistant/assistantSettings';
import { classifySingle, ENTITY_LABEL } from '../../notebook/entities';
import { notebook } from '../../notebook/notebookStore';

const MIN = 2; const MAX = 4000;
// Places where a selection already has its own tools (editors, inputs) or where the toolbar would be noise.
const SKIP = 'input, textarea, select, [contenteditable="true"], .ProseMirror, .sn-menu, .sn-slash, .sn-bubble, .ws-palette, .ws-context-menu, .sel-toolbar, .as-composer, [data-no-selection-toolbar], nav, .sidebar, header.topbar, .topbar';

// Select text anywhere on the dashboard (or in an AI answer) and act on it without leaving the page.
export default function SelectionToolbar({ page }) {
  const a = useAssistant();
  const settings = useAiSettings();
  const [sel, setSel] = useState(null);
  const [flash, setFlash] = useState('');
  const timer = useRef(null);
  const enabled = settings.selectionToolbar;

  useEffect(() => {
    if (!enabled) { setSel(null); return undefined; }
    const read = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !s.rangeCount) { setSel(null); return; }
      const text = s.toString().trim();
      const range = s.getRangeAt(0);
      const el = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      if (text.length < MIN || text.length > MAX || !el || el.closest(SKIP) || (s.anchorNode?.parentElement?.closest(SKIP))) { setSel(null); return; }
      const r = range.getBoundingClientRect();
      if (!r || (r.width === 0 && r.height === 0)) { setSel(null); return; }
      setSel({ text, x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
    };
    const later = () => { clearTimeout(timer.current); timer.current = setTimeout(read, 90); };
    const hide = () => setSel(null);
    document.addEventListener('mouseup', later);
    document.addEventListener('keyup', later);
    document.addEventListener('selectionchange', later);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => { clearTimeout(timer.current); document.removeEventListener('mouseup', later); document.removeEventListener('keyup', later); document.removeEventListener('selectionchange', later); window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); };
  }, [enabled]);

  useEffect(() => {
    if (!sel) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setSel(null); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [sel]);

  if (!sel || !a) return null;
  const entity = classifySingle(sel.text);
  const above = sel.top > 56;
  const left = Math.max(8, Math.min(sel.x - 120, window.innerWidth - 248));
  const top = above ? sel.top - 44 : sel.bottom + 8;
  const done = (k) => { setFlash(k); setTimeout(() => setFlash(''), 1400); };
  const stay = (e) => e.preventDefault(); // keep the text selected while clicking

  return (
    <div className="sel-toolbar" role="toolbar" aria-label="Selection actions" style={{ left, top }} onMouseDown={stay}>
      <button type="button" onClick={() => { a.askAbout(sel.text, { from: `Selected on ${page}` }); setSel(null); }} title="Ask the AI Analyst about this text"><Sparkles size={14} aria-hidden="true" /><span>Ask AI</span></button>
      <button type="button" onClick={() => { notebook.addSnippet(sel.text, `${page} page`); done('nb'); }} title="Append to the open note with source and time"><NotebookPen size={14} aria-hidden="true" /><span>{flash === 'nb' ? 'Added' : 'Add to Notebook'}</span>{flash === 'nb' && <Check size={12} aria-hidden="true" />}</button>
      {entity && <button type="button" onClick={() => { notebook.addIoc({ type: entity.type, value: entity.value, context: `Selected on ${page}`, source: `Dashboard: ${page}` }); done('ioc'); }} title={`Add this ${ENTITY_LABEL[entity.type].toLowerCase()} to the note's IOC table`}><Crosshair size={14} aria-hidden="true" /><span>{flash === 'ioc' ? 'Added' : 'Add as IOC'}</span></button>}
      <button type="button" className="sel-icon" onClick={async () => { try { await navigator.clipboard.writeText(sel.text); done('copy'); } catch { /* blocked */ } }} aria-label="Copy selected text" title="Copy">{flash === 'copy' ? <Check size={14} /> : <Copy size={14} />}</button>
    </div>
  );
}
