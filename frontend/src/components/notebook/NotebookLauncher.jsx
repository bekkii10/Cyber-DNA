import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { BookOpenText } from 'lucide-react';
import { notebook, useNotebook } from '../../notebook/notebookStore';
import { NOTEBOOK_INSERT_EVENT, NOTEBOOK_OPEN_EVENT } from '../interactions/events';

// The editor (Tiptap/ProseMirror) is a separate chunk: dashboard load is unaffected until the notebook is first opened.
const NotebookWindow = lazy(() => import('./NotebookWindow'));

export default function NotebookLauncher() {
  const open = useNotebook((s) => s.open);
  const btn = useRef(null); const was = useRef(false);

  useEffect(() => {
    const onOpen = () => notebook.open();
    const onInsert = (e) => {
      const d = e.detail || {};
      if (d.snippet) notebook.addSnippet(d.snippet, d.source);
      else notebook.addEvidence(d.ctx || { type: d.type, ...(d.item || {}) });
    };
    window.addEventListener(NOTEBOOK_OPEN_EVENT, onOpen);
    window.addEventListener(NOTEBOOK_INSERT_EVENT, onInsert);
    return () => { window.removeEventListener(NOTEBOOK_OPEN_EVENT, onOpen); window.removeEventListener(NOTEBOOK_INSERT_EVENT, onInsert); };
  }, []);
  useEffect(() => { if (was.current && !open) btn.current?.focus(); was.current = open; }, [open]);

  return (
    <div className="sn-root">
      <div className="sn-launch-wrap">
        <button ref={btn} type="button" className="sn-launcher" onClick={notebook.toggle} aria-expanded={open} aria-keyshortcuts="Alt+N" aria-label={open ? 'Close Security Notebook' : 'Open Security Notebook'} title="Security Notebook (Alt+N)"><BookOpenText size={19} /><span>Notebook</span></button>
      </div>
      {open && <Suspense fallback={<div className="sn-loading" role="status">Loading notebook…</div>}><NotebookWindow /></Suspense>}
    </div>
  );
}
