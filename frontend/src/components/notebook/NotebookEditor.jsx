import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Bold, Check, CircleCheck, Clock, Code2, Columns3, Copy, Eraser, Eye, Flag, Heading1, Heading2, Heading3, Highlighter, Italic, Lightbulb, Link2, List, ListOrdered, ListTodo, Loader2, Minus, NotebookPen, Quote, Redo2, RefreshCw, Rows3, Sparkles, Strikethrough, Table2, Trash2, TriangleAlert, Underline as UnderlineIcon, Undo2, Wand2, Crosshair, ShieldPlus, X } from 'lucide-react';
import { buildExtensions } from './extensions';
import { MenuButton } from './Menu';
import RichText from '../assistant/RichText';
import { useAssistant } from '../assistant/AssistantProvider';
import { toAssistantError } from '../../api/assistant';
import { AI_TASKS, buildMessage } from '../../notebook/aiTasks';
import { SECURITY_BLOCKS, aiBlock, localNow, textToHtml, utcNow } from '../../notebook/blocks';
import { cleanHtml } from '../../notebook/sanitize';
import { classifySingle } from '../../notebook/entities';
import { notebook } from '../../notebook/notebookStore';

const LINK_OK = /^(https?:\/\/|mailto:)/i;
const CALLOUT_ICON = { observation: Eye, hypothesis: Lightbulb, finding: CircleCheck, action: Flag, warning: TriangleAlert };
const CALLOUT_LABEL = { observation: 'Observation', hypothesis: 'Hypothesis', finding: 'Finding (confirmed)', action: 'Action item', warning: 'Warning' };

function Btn({ icon: Icon, label, active, onClick, disabled, kbd }) {
  return (
    <button type="button" className={`sn-tb ${active ? 'on' : ''}`} aria-label={label} aria-pressed={active === undefined ? undefined : !!active} title={kbd ? `${label} (${kbd})` : label} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      <Icon size={15} aria-hidden="true" />
    </button>
  );
}

export default function NotebookEditor({ note, rev, settings, onChange, onEditor, onOpenDrawer }) {
  const assistant = useAssistant();
  const [slash, setSlash] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [link, setLink] = useState(null);
  const [card, setCard] = useState(null);
  const [copied, setCopied] = useState(false);
  const bubbleEl = useRef(null); const token = useRef(0); const runRef = useRef(null);
  const lastEmitted = useRef(note.html);
  const utc = settings.utcTimestamps;

  const slashItems = useMemo(() => {
    const ins = (html) => (ed) => ed.chain().focus().insertContent(html).run();
    const base = [
      { id: 'p', group: 'Basic', title: 'Text', hint: 'Plain paragraph', run: (ed) => ed.chain().focus().setParagraph().run() },
      { id: 'h1', group: 'Basic', title: 'Heading 1', hint: 'Large section title', run: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run() },
      { id: 'h2', group: 'Basic', title: 'Heading 2', hint: 'Section heading', run: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run() },
      { id: 'h3', group: 'Basic', title: 'Heading 3', hint: 'Sub-heading', run: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run() },
      { id: 'ul', group: 'Basic', title: 'Bullet list', hint: 'Simple list', run: (ed) => ed.chain().focus().toggleBulletList().run() },
      { id: 'ol', group: 'Basic', title: 'Numbered list', hint: 'Ordered steps', run: (ed) => ed.chain().focus().toggleOrderedList().run() },
      { id: 'todo', group: 'Basic', title: 'Task list', hint: 'Checkboxes', run: (ed) => ed.chain().focus().toggleTaskList().run() },
      { id: 'quote', group: 'Basic', title: 'Quote', hint: 'Quoted evidence', run: (ed) => ed.chain().focus().toggleBlockquote().run() },
      { id: 'code', group: 'Basic', title: 'Code block', hint: 'Commands, queries, log lines', run: (ed) => ed.chain().focus().toggleCodeBlock().run() },
      { id: 'hr', group: 'Basic', title: 'Divider', hint: 'Horizontal rule', run: (ed) => ed.chain().focus().setHorizontalRule().run() },
      { id: 'now', group: 'Security', title: utc ? 'Timestamp (UTC now)' : 'Timestamp (local now)', hint: utc ? utcNow() : localNow(), keywords: 'time date utc', run: (ed) => ed.chain().focus().insertContent(`${utc ? utcNow() : localNow()} `).run() },
    ];
    const security = Object.entries(SECURITY_BLOCKS).map(([id, b]) => ({ id: `sec-${id}`, group: 'Security', title: b.label, hint: b.hint, keywords: id, run: ins(b.html()) }));
    const ai = [
      { id: 'ai-ask', group: 'AI', title: 'Ask AI…', hint: 'Ask about the selection or this note', keywords: 'ai ask', run: () => runRef.current('ask') },
      ...['summarize', 'actions', 'timeline', 'exec', 'next', 'improve', 'explain'].map((t) => ({ id: `ai-${t}`, group: 'AI', title: AI_TASKS[t].label, hint: AI_TASKS[t].scope === 'note' ? 'Uses this note' : 'Uses the selected text', keywords: `ai ${t}`, run: () => runRef.current(t) })),
    ];
    return [...base, ...security, ...ai];
  }, [utc]);

  const extensions = useMemo(() => buildExtensions({
    placeholder: 'Start recording the investigation… type / for blocks and AI',
    getItems: (q) => { const s = q.toLowerCase(); return slashItems.filter((i) => !s || `${i.title} ${i.keywords || ''} ${i.group}`.toLowerCase().includes(s)).slice(0, 12); },
    onSlash: setSlash,
  }), [slashItems]);

  const editor = useEditor({
    extensions,
    content: note.html,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'sn-editor', role: 'textbox', 'aria-label': 'Security investigation note', 'aria-multiline': 'true', spellcheck: String(settings.spellcheck) } },
    onUpdate: ({ editor: e }) => { const html = cleanHtml(e.getHTML()); lastEmitted.current = html; onChange(html); },
  }, [extensions]);

  useEffect(() => { onEditor?.(editor); return () => onEditor?.(null); }, [editor, onEditor]);

  // External changes (dashboard capture, restore, AI save) arrive through the store; apply them without echoing back.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (note.html !== lastEmitted.current) { lastEmitted.current = note.html; editor.commands.setContent(note.html, { emitUpdate: false }); }
  }, [rev, note.html, editor]);

  // Selection bubble position.
  useEffect(() => {
    if (!editor) return undefined;
    const update = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || !editor.isFocused || editor.isActive('codeBlock') || editor.state.selection.constructor.name === 'CellSelection') { setBubble(null); return; }
      try {
        const a = editor.view.coordsAtPos(from); const b = editor.view.coordsAtPos(to);
        setBubble({ x: (a.left + b.right) / 2, y: Math.min(a.top, b.top), text: editor.state.doc.textBetween(from, to, ' ') });
      } catch { setBubble(null); }
    };
    const hide = () => setTimeout(() => { if (!bubbleEl.current?.contains(document.activeElement)) setBubble(null); }, 0);
    editor.on('selectionUpdate', update); editor.on('focus', update); editor.on('blur', hide);
    return () => { editor.off('selectionUpdate', update); editor.off('focus', update); editor.off('blur', hide); };
  }, [editor]);

  const getSel = useCallback(() => {
    if (!editor) return null;
    const { from, to, empty } = editor.state.selection;
    if (empty) return null;
    const text = editor.state.doc.textBetween(from, to, '\n');
    return text.trim() ? { from, to, text } : null;
  }, [editor]);

  const runAi = useCallback(async (taskId, custom) => {
    const task = AI_TASKS[taskId]; const sel = getSel();
    if (task.scope === 'selection' && !sel) { setCard({ status: 'error', task, error: 'Select some text in the note first.' }); return; }
    if (task.scope === 'custom' && custom === undefined) { setCard({ status: 'input', task, selection: sel }); return; }
    const id = (token.current += 1);
    setCard({ status: 'loading', task, selection: sel, custom });
    try {
      const res = await assistant.askOnce({ message: buildMessage(task, custom), selectionText: task.scope === 'note' ? undefined : sel?.text, includeNote: task.scope === 'note' || (task.scope === 'custom' && !sel) });
      if (id === token.current) setCard({ status: 'done', task, selection: sel, custom, result: res });
    } catch (e) {
      if (id === token.current) setCard({ status: 'error', task, selection: sel, custom, error: toAssistantError(e).message });
    }
  }, [assistant, getSel]);
  runRef.current = (t) => runAi(t);

  const discard = () => { token.current += 1; setCard(null); };
  const canReplace = card?.status === 'done' && card.task.replace && card.selection && editor && editor.state.doc.textBetween(card.selection.from, card.selection.to, '\n') === card.selection.text;
  const replaceSel = () => {
    notebook.snapshot(note.id, 'Before AI replace');
    const t = card.result.text.trim(); const range = { from: card.selection.from, to: card.selection.to };
    editor.chain().focus().insertContentAt(range, t.includes('\n') ? textToHtml(t) : { type: 'text', text: t }).run();
    setCard(null);
  };
  const insertBelow = () => {
    const sel = card.selection; const $to = editor.state.doc.resolve(sel ? sel.to : editor.state.selection.to);
    const pos = $to.depth >= 1 ? $to.after(1) : editor.state.doc.content.size;
    editor.chain().focus().insertContentAt(pos, aiBlock(card.result.text, { question: card.task.scope === 'custom' ? card.custom : card.task.label })).run();
    setCard(null);
  };
  const copyResult = async () => { try { await navigator.clipboard.writeText(card.result.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };

  const openLink = () => setLink({ url: editor.getAttributes('link').href || 'https://' });
  const applyLink = (e) => {
    e.preventDefault();
    if (!LINK_OK.test(link.url.trim())) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: link.url.trim() }).run(); setLink(null);
  };
  const addIoc = () => { const h = classifySingle(bubble?.text); if (h) notebook.addIoc({ type: h.type === 'hash' ? 'hash' : h.type, value: h.value, source: 'Note selection' }); };

  if (!editor) return <div className="sn-editor-wrap" />;
  const c = () => editor.chain().focus();
  const inTable = editor.isActive('table');
  const single = bubble ? classifySingle(bubble.text) : null;
  const aiMenu = (scopes) => Object.entries(AI_TASKS).filter(([, t]) => scopes.includes(t.scope)).map(([id, t]) => ({ id, label: t.label, icon: Sparkles, onSelect: () => runAi(id) }));

  return (
    <>
      <div className="sn-toolbar" role="toolbar" aria-label="Note formatting">
        <MenuButton icon={Table2} label="Insert security block" text="Insert" title="Insert evidence, timeline, IOC, ATT&CK, custody tables and checklists"
          items={[{ id: 'now', group: 'Quick', label: utc ? 'Timestamp (UTC now)' : 'Timestamp (local now)', icon: Clock, onSelect: () => c().insertContent(`${utc ? utcNow() : localNow()} `).run() },
            ...Object.entries(SECURITY_BLOCKS).filter(([id]) => !CALLOUT_ICON[id]).map(([id, b]) => ({ id, group: id.endsWith('List') ? 'Checklists' : 'Tables', label: b.label, hint: b.hint, icon: id.endsWith('List') ? ListTodo : Table2, onSelect: () => c().insertContent(b.html()).run() }))]} />
        <MenuButton icon={Lightbulb} label="Mark as observation, hypothesis or finding" text="Mark" title="Keep facts and guesses apart"
          items={Object.keys(CALLOUT_ICON).map((k) => ({ id: k, label: CALLOUT_LABEL[k], icon: CALLOUT_ICON[k], onSelect: () => c().toggleCallout(k).run() }))} />
        <MenuButton icon={Sparkles} label="AI actions" text="AI" title="AI actions for this note or selection (results are reviewed before use)"
          items={[{ id: 'ask', group: 'Ask', label: 'Ask AI…', icon: Sparkles, onSelect: () => runAi('ask') }, ...aiMenu(['note']).map((i) => ({ ...i, group: 'This note' })), ...aiMenu(['selection']).map((i) => ({ ...i, group: 'Selected text' }))]} />
        <i />
        <Btn icon={Heading1} label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()} />
        <Btn icon={Heading2} label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()} />
        <Btn icon={Heading3} label="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()} />
        <i />
        <Btn icon={Bold} label="Bold" kbd="Ctrl+B" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()} />
        <Btn icon={Italic} label="Italic" kbd="Ctrl+I" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()} />
        <Btn icon={UnderlineIcon} label="Underline" kbd="Ctrl+U" active={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()} />
        <Btn icon={Strikethrough} label="Strikethrough" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()} />
        <Btn icon={Highlighter} label="Highlight" active={editor.isActive('highlight')} onClick={() => c().toggleHighlight().run()} />
        <i />
        <Btn icon={List} label="Bullet list" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()} />
        <Btn icon={ListOrdered} label="Numbered list" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()} />
        <Btn icon={ListTodo} label="Task list" active={editor.isActive('taskList')} onClick={() => c().toggleTaskList().run()} />
        <Btn icon={Quote} label="Quote" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()} />
        <Btn icon={Code2} label="Code block" active={editor.isActive('codeBlock')} onClick={() => c().toggleCodeBlock().run()} />
        <Btn icon={Link2} label="Link" active={editor.isActive('link')} onClick={openLink} />
        <Btn icon={Table2} label="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        <Btn icon={Minus} label="Divider" onClick={() => c().setHorizontalRule().run()} />
        <i />
        <Btn icon={Undo2} label="Undo" kbd="Ctrl+Z" disabled={!editor.can().undo()} onClick={() => c().undo().run()} />
        <Btn icon={Redo2} label="Redo" kbd="Ctrl+Shift+Z" disabled={!editor.can().redo()} onClick={() => c().redo().run()} />
        <Btn icon={Eraser} label="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()} />
      </div>
      {inTable && (
        <div className="sn-toolbar sn-table-tools" role="toolbar" aria-label="Table tools">
          <span className="sn-tb-label">Table</span>
          <Btn icon={Rows3} label="Add row below" onClick={() => c().addRowAfter().run()} />
          <Btn icon={Columns3} label="Add column right" onClick={() => c().addColumnAfter().run()} />
          <button type="button" className="sn-tb-text" onMouseDown={(e) => e.preventDefault()} onClick={() => c().toggleHeaderRow().run()}>Header row</button>
          <button type="button" className="sn-tb-text" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteRow().run()}>Delete row</button>
          <button type="button" className="sn-tb-text" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteColumn().run()}>Delete column</button>
          <button type="button" className="sn-tb-text danger" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteTable().run()}><Trash2 size={12} /> Delete table</button>
        </div>
      )}
      {link && (
        <form className="sn-linkbar" onSubmit={applyLink}>
          <Link2 size={14} aria-hidden="true" />
          <input autoFocus value={link.url} onChange={(e) => setLink({ url: e.target.value })} aria-label="Link address" placeholder="https://…" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setLink(null); editor.commands.focus(); } }} />
          <button type="submit" className="sn-text-button" disabled={!LINK_OK.test(link.url.trim())}>Apply</button>
          {editor.isActive('link') && <button type="button" className="sn-text-button" onClick={() => { c().extendMarkRange('link').unsetLink().run(); setLink(null); }}>Remove</button>}
          <button type="button" className="sn-icon" aria-label="Close link editor" onClick={() => setLink(null)}><X size={14} /></button>
        </form>
      )}

      <div className="sn-editor-wrap"><EditorContent editor={editor} /></div>

      {bubble && (
        <div ref={bubbleEl} className="sn-bubble" role="toolbar" aria-label="Selection actions" style={{ left: Math.max(8, Math.min(bubble.x - 150, window.innerWidth - 316)), top: Math.max(8, bubble.y - 46) }} onMouseDown={(e) => e.preventDefault()}>
          <Btn icon={Bold} label="Bold" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()} />
          <Btn icon={Italic} label="Italic" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()} />
          <Btn icon={UnderlineIcon} label="Underline" active={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()} />
          <Btn icon={Highlighter} label="Highlight" active={editor.isActive('highlight')} onClick={() => c().toggleHighlight().run()} />
          <Btn icon={Link2} label="Link" active={editor.isActive('link')} onClick={openLink} />
          <i />
          <MenuButton icon={Wand2} label="Ask AI about selection" text="Ask AI" className="sn-tb sn-tb-wide" items={aiMenu(['selection', 'custom']).map((i) => ({ ...i, group: undefined }))} />
          {single && <Btn icon={Crosshair} label="Add selection as IOC" onClick={addIoc} />}
        </div>
      )}

      {slash && slash.items.length > 0 && (
        <div className="sn-slash" role="listbox" aria-label="Insert block" style={{ left: Math.max(8, Math.min(slash.rect?.left ?? 24, window.innerWidth - 300)), top: Math.min((slash.rect?.bottom ?? 120) + 6, window.innerHeight - 280) }} onMouseDown={(e) => e.preventDefault()}>
          {slash.items.map((it, i) => (
            <React.Fragment key={it.id}>
              {(i === 0 || slash.items[i - 1].group !== it.group) && <div className="sn-menu-group" role="presentation">{it.group}</div>}
              <button type="button" role="option" aria-selected={i === slash.index} className={`sn-menu-item ${i === slash.index ? 'on' : ''}`} onClick={() => slash.select(i)}>
                {it.group === 'AI' ? <Sparkles size={14} /> : it.group === 'Security' ? <ShieldPlus size={14} /> : <NotebookPen size={14} />}<span className="sn-menu-text"><b>{it.title}</b><small>{it.hint}</small></span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {card && (
        <section className="sn-ai-card" aria-label="AI result" aria-live="polite">
          <header><Sparkles size={14} aria-hidden="true" /><b>{card.task.label}</b><span className="sn-ai-tag">AI draft: review before use</span><button type="button" className="sn-icon" onClick={discard} aria-label="Discard AI result"><X size={14} /></button></header>
          {card.status === 'input' && (
            <form className="sn-ai-input" onSubmit={(e) => { e.preventDefault(); const v = e.currentTarget.elements.q.value.trim(); if (v) runAi('ask', v); }}>
              <input name="q" autoFocus aria-label="Ask AI" placeholder={card.selection ? 'Ask about the selected text…' : 'Ask about this note…'} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); discard(); } }} />
              <button type="submit" className="btn btn-primary btn-sm">Ask</button>
              <small>{card.selection ? 'Only the selected text is sent.' : 'An excerpt of this note is sent. TLP:RED notes are blocked.'}</small>
            </form>
          )}
          {card.status === 'loading' && <div className="sn-ai-body" role="status"><Loader2 size={15} className="spin" aria-hidden="true" /> Working… <button type="button" className="as-link" onClick={discard}>Cancel</button></div>}
          {card.status === 'error' && <div className="sn-ai-body sn-ai-err" role="alert"><TriangleAlert size={15} aria-hidden="true" /><span>{card.error}</span>{card.task.scope !== 'selection' || card.selection ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => runAi(Object.keys(AI_TASKS).find((k) => AI_TASKS[k] === card.task), card.custom)}><RefreshCw size={12} /> Retry</button> : null}</div>}
          {card.status === 'done' && (
            <>
              <div className="sn-ai-body"><RichText text={card.result.text} ids={[]} /></div>
              <footer>
                {canReplace && <button type="button" className="btn btn-primary btn-sm" onClick={replaceSel}>Replace selection</button>}
                <button type="button" className={`btn btn-${canReplace ? 'secondary' : 'primary'} btn-sm`} onClick={insertBelow}>Insert below</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={copyResult}>{copied ? <Check size={12} /> : <Copy size={12} />} Copy</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => runAi(Object.keys(AI_TASKS).find((k) => AI_TASKS[k] === card.task), card.custom)}><RefreshCw size={12} /> Try again</button>
                <button type="button" className="as-link" onClick={discard}>Discard</button>
              </footer>
            </>
          )}
        </section>
      )}
    </>
  );
}
