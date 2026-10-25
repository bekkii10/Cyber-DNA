import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpenText, Crosshair, FileText, Grip, Library, Maximize2, Minimize2, Move, Pin, PinOff, Plus, Printer, Settings, Share2, ShieldCheck, Trash2, X, Download } from 'lucide-react';
import useFloatingWindow from '../../hooks/useFloatingWindow';
import NotebookEditor from './NotebookEditor';
import NotebookDrawer, { TlpBadge } from './NotebookDrawer';
import ShareDialog from './ShareDialog';
import { MenuButton } from './Menu';
import { notebook, useNotebook, activeNoteOf, flush } from '../../notebook/notebookStore';
import { TEMPLATE_LIST } from '../../notebook/templates';
import { TLP, STATUSES } from '../../notebook/securityKB';
import { exportNote, iocCsv, safeFile } from '../../notebook/exporters';
import { extractEntities } from '../../notebook/entities';
import { htmlToText } from '../../notebook/sanitize';
import { downloadText } from '../../notebook/download';

export default function NotebookWindow() {
  const state = useNotebook((s) => s);
  const note = activeNoteOf(state);
  const { settings, drawer, saveState, lastSavedAt, rev } = state;
  const floating = useFloatingWindow('cyberdna-notebook-window', 380, 420, { width: 620, height: 700, leftOffset: 1080, top: 104 });
  const [minimized, setMinimized] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [tagDraft, setTagDraft] = useState('');
  const editorRef = useRef(null);
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const setEditor = useCallback((ed) => { editorRef.current = ed; }, []);

  useEffect(() => { floating.bringToFront(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => flush(), []);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 8000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { // counts follow the stored note so they work for external changes too
    const text = htmlToText(note.html); setCounts({ words: (text.match(/\S+/g) || []).length, chars: text.length });
  }, [note.html]);

  const onChange = useCallback((html) => notebook.updateNote(note.id, { html }), [note.id]);
  const insert = useCallback((html) => {
    const ed = editorRef.current;
    if (ed && !ed.isDestroyed) ed.chain().focus().insertContent(html).run(); else notebook.appendHtml(html, { open: false });
  }, []);
  const toggleDrawer = (tab) => notebook.setDrawer(drawer === tab ? null : tab);
  const remove = () => { const gone = notebook.deleteNote(note.id); if (gone) setToast({ id: gone.id, title: gone.title }); };
  const addTag = (raw) => {
    const t = raw.trim().replace(/^#/, '').slice(0, 30);
    if (t && !note.tags.includes(t) && note.tags.length < 12) notebook.updateNote(note.id, { tags: [...note.tags, t] });
    setTagDraft('');
  };
  const doExport = (fmt) => downloadText(`${safeFile(note.title)}.${fmt}`, exportNote(note, fmt, { defangIocs: settings.defangExports, banner: settings.tlpBanner }), fmt);
  const exportItems = [
    { id: 'md', label: 'Markdown (.md)', icon: Download, onSelect: () => doExport('md') },
    { id: 'txt', label: 'Plain text (.txt)', icon: Download, onSelect: () => doExport('txt') },
    { id: 'html', label: 'Formatted HTML (.html)', icon: Download, onSelect: () => doExport('html') },
    { id: 'csv', label: 'Indicators (.csv)', hint: 'Defanged', icon: Download, onSelect: () => downloadText(`${safeFile(note.title)}-iocs.csv`, iocCsv(extractEntities(htmlToText(note.html))), 'csv') },
    { id: 'print', label: 'Print or save as PDF', icon: Printer, onSelect: () => window.print() },
  ];
  const newItems = [{ id: 'default', group: 'Quick', label: 'New note (default template)', icon: Plus, onSelect: () => notebook.createNote() },
    ...TEMPLATE_LIST.map((t) => ({ id: t.id, group: t.group, label: t.title, hint: t.desc, icon: FileText, onSelect: () => notebook.createNote(t.id) }))];
  const saved = saveState === 'error' ? 'Storage full: download a backup' : saveState === 'saving' ? 'Saving…' : `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  return (
    <>
      <section className={`sn-panel floating-workspace sn-window ${minimized ? 'sn-minimized' : ''}`} data-font={settings.fontSize} data-width={settings.width} style={{ ...floating.style, height: minimized ? 56 : floating.style.height }} aria-label="Security Notebook" onPointerDownCapture={floating.bringToFront}>
        <header className="sn-head as-drag-handle" onPointerDown={floating.onDragStart} onKeyDown={floating.onKeyDown} onDoubleClick={(e) => { if (!e.target.closest('button, a')) floating.toggleMaximize(); }} tabIndex={0} aria-label="Security Notebook window. Alt plus arrow keys move it; Alt plus Shift plus arrows resize it." title="Drag to move. Double-click to maximize.">
          <Move size={13} className="as-drag-mark" aria-hidden="true" />
          <div className="sn-brand"><span className="sn-brand-icon"><ShieldCheck size={17} /></span><div><strong>Security Notebook</strong><small>Cyber DNA · Analyst workspace</small></div></div>
          <div className="sn-head-actions">
            <button type="button" className={`sn-icon ${drawer === 'notes' ? 'on' : ''}`} onClick={() => toggleDrawer('notes')} aria-label="Browse notes" aria-pressed={drawer === 'notes'} title="Notes"><FileText size={16} /></button>
            <button type="button" className={`sn-icon ${drawer === 'reference' ? 'on' : ''}`} onClick={() => toggleDrawer('reference')} aria-label="Security reference" aria-pressed={drawer === 'reference'} title="Security reference"><Library size={16} /></button>
            <button type="button" className={`sn-icon ${drawer === 'iocs' ? 'on' : ''}`} onClick={() => toggleDrawer('iocs')} aria-label="Indicators in this note" aria-pressed={drawer === 'iocs'} title="Indicators (IOCs)"><Crosshair size={16} /></button>
            <button type="button" className={`sn-icon ${drawer === 'settings' ? 'on' : ''}`} onClick={() => toggleDrawer('settings')} aria-label="Notebook settings" aria-pressed={drawer === 'settings'} title="Settings"><Settings size={16} /></button>
            <MenuButton icon={Plus} label="New note" className="sn-icon" title="New note" items={newItems} />
            <button type="button" className="sn-icon" onClick={floating.toggleMaximize} aria-label={floating.maximized ? 'Restore notebook size' : 'Maximize notebook'} title={floating.maximized ? 'Restore size' : 'Maximize'}><Maximize2 size={15} /></button>
            <button type="button" className="sn-icon" onClick={() => setMinimized((v) => !v)} aria-label={minimized ? 'Restore notebook' : 'Minimize notebook'} title={minimized ? 'Restore' : 'Minimize'}><Minimize2 size={16} /></button>
            <button type="button" className="sn-icon" onClick={notebook.close} aria-label="Close notebook" title="Close"><X size={17} /></button>
          </div>
        </header>
        {!minimized && (
          <>
            {drawer && <NotebookDrawer tab={drawer} onTab={notebook.setDrawer} onClose={() => notebook.setDrawer(null)} settings={settings} insert={insert} floating={floating} />}
            <div className="sn-title-row">
              <input value={note.title} onChange={(e) => notebook.updateNote(note.id, { title: e.target.value })} aria-label="Note title" placeholder="Name this investigation" />
              <button type="button" className="sn-icon" onClick={() => notebook.togglePin(note.id)} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} aria-pressed={note.pinned} title={note.pinned ? 'Unpin' : 'Pin to top'}>{note.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
              <button type="button" className="sn-icon danger" onClick={remove} aria-label="Delete note" title="Move to Recently deleted"><Trash2 size={15} /></button>
            </div>
            <div className="sn-props">
              <label className={`tlp-select tlp-${note.tlp.replace('+', '-')}`}><span className="sr-only">TLP marking</span><select value={note.tlp} onChange={(e) => notebook.updateNote(note.id, { tlp: e.target.value })} aria-label="TLP marking">{TLP.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
              <select value={note.status} onChange={(e) => notebook.updateNote(note.id, { status: e.target.value })} aria-label="Note status">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <input className="sn-case" value={note.caseRef} onChange={(e) => notebook.updateNote(note.id, { caseRef: e.target.value })} placeholder="Case / alert ID" aria-label="Case or alert ID" maxLength={60} />
              <div className="sn-tags">
                {note.tags.map((t) => <span key={t} className="nb-tag on">#{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => notebook.updateNote(note.id, { tags: note.tags.filter((x) => x !== t) })}><X size={10} /></button></span>)}
                <input value={tagDraft} onChange={(e) => (e.target.value.endsWith(',') ? addTag(e.target.value.slice(0, -1)) : setTagDraft(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagDraft); } else if (e.key === 'Backspace' && !tagDraft && note.tags.length) notebook.updateNote(note.id, { tags: note.tags.slice(0, -1) }); }} onBlur={() => tagDraft && addTag(tagDraft)} placeholder={note.tags.length ? '' : 'Add tags'} aria-label="Add tag" maxLength={30} />
              </div>
            </div>
            <NotebookEditor key={note.id} note={note} rev={rev} settings={settings} onChange={onChange} onEditor={setEditor} onOpenDrawer={notebook.setDrawer} />
            {toast && <div className="sn-toast" role="status"><span>“{toast.title}” moved to Recently deleted.</span><button type="button" className="nb-text-btn" aria-label="Undo delete" onClick={() => { notebook.restoreNote(toast.id); setToast(null); }}>Undo</button></div>}
            <div className="sn-footer">
              <div className="sn-save-state"><span className={`sn-save-dot ${saveState}`} />{saved}{settings.showCounts && <span className="sn-counts">{counts.words} words · {counts.chars} chars</span>}</div>
              <div className="sn-export"><MenuButton icon={Download} label="Export note" text="Export" className="sn-foot-btn" items={exportItems} /><button type="button" className="sn-share" onClick={() => setShareOpen(true)}><Share2 size={14} /> Share</button></div>
            </div>
            <p className="sn-privacy"><TlpBadge id={note.tlp} /><span>Notes stay in this browser. Check for sensitive usernames, IPs and evidence before sharing.</span></p>
          </>
        )}
        {!minimized && <button type="button" className="floating-resize-handle sn-resize" onPointerDown={floating.onResizeStart} aria-label="Resize Security Notebook" title="Drag to resize"><Grip size={15} /></button>}
      </section>
      {shareOpen && <ShareDialog note={note} settings={settings} onClose={() => setShareOpen(false)} />}
    </>
  );
}
