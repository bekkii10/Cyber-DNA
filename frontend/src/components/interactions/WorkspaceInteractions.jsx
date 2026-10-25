import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowRight, Bot, Copy, Crosshair, FileSearch, FileText, Keyboard, NotebookPen, Search, Settings, ShieldAlert, Sparkles, UserRound, X, Braces } from 'lucide-react';
import { useAssistant } from '../assistant/AssistantProvider';
import { alertContext, incidentContext, suggestionsFor, userContext } from '../assistant/contextBuilders';
import { CONTEXT_EVENT, PALETTE_EVENT, NOTEBOOK_OPEN_EVENT } from './events';
import SelectionToolbar from './SelectionToolbar';
import { notebook, useNotebook } from '../../notebook/notebookStore';
import { TEMPLATE_LIST } from '../../notebook/templates';
import { tlpOf } from '../../notebook/securityKB';

const NAV_ITEMS = [
  ['Overview', 'Overview'], ['Alerts', 'Alerts'], ['Incidents', 'Incidents'],
  ['User Behavior', 'User Behavior'], ['Hosts', 'Hosts'], ['Detection Rules', 'Detection Rules'],
  ['Risk & ML', 'Risk & ML'], ['Architecture', 'Architecture'],
];
const textOf = (v) => (v === undefined || v === null || v === '' ? '' : String(v));
const labelOf = (type, item) => ({
  alert: item?.title || item?.id || 'alert', incident: item?.title || item?.id || 'incident',
  event: item?.eventId || item?.id || 'event', user: item?.username || 'user', host: item?.hostname || 'host', rule: item?.name || item?.id || 'rule',
}[type] || 'item');
export const contextOf = (type, item) => {
  if (type === 'alert') return alertContext(item);
  if (type === 'incident') return incidentContext(item);
  if (type === 'user') return userContext(item);
  if (type === 'host') return { type: 'host', hostname: item.hostname, ip: item.ip, os: item.os, status: item.status, riskScore: item.risk, lastSeen: item.ts, eventCount: item.events };
  if (type === 'rule') return { type: 'rule', id: item.id, name: item.name, eventId: item.eventId, severity: item.severity, enabled: item.enabled, mitre: item.mitre, description: item.description };
  if (type === 'event') return { type: 'event', id: item.id, eventId: item.eventId, description: item.desc, time: item.ts };
  return { type, ...item };
};
const ROUTES = { alert: 'Alerts', incident: 'Incidents', user: 'User Behavior', host: 'Hosts', rule: 'Detection Rules' };
const ENTITY_ROUTE = { alert: 'Alerts', incident: 'Incidents', user: 'User Behavior', host: 'Hosts', rule: 'Detection Rules' };
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || '');
const DEDUPE_MS = 600;

export default function WorkspaceInteractions({ page, go, data }) {
  const assistant = useAssistant();
  const { open: assistantOpen, toggle: toggleAssistant, setPageContext, askAbout, setSettingsOpen, setOpen: setAssistantOpen } = assistant;
  const notes = useNotebook((s) => s.notes);
  const notebookOpen = useNotebook((s) => s.open);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [contextMenu, setContextMenu] = useState(null);
  const [pos, setPos] = useState(null);
  const [selectedAtOpen, setSelectedAtOpen] = useState('');
  const paletteInput = useRef(null); const menuRef = useRef(null); const lastOpen = useRef({ t: 0, x: 0, y: 0 }); const menuIsOpen = useRef(false);
  menuIsOpen.current = !!contextMenu;

  const closePalette = useCallback(() => { setPaletteOpen(false); setPaletteQuery(''); setActive(0); }, []);
  const closeMenu = useCallback(() => { setContextMenu(null); setPos(null); }, []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const openPalette = useCallback(() => {
    setSelectedAtOpen((window.getSelection?.().toString() || '').trim().slice(0, 4000));
    setContextMenu(null); setPaletteOpen(true); setActive(0);
  }, []);
  const toggleNotebook = useCallback(() => notebook.toggle(), []);

  const commands = useMemo(() => {
    const q = paletteQuery.trim();
    const jump = (type, route) => (item) => ({ run: () => { go(route); window.dispatchEvent(new CustomEvent(CONTEXT_EVENT, { detail: { type, item, x: 0, y: 0, palette: true } })); } });
    const mk = (type) => jump(type, ENTITY_ROUTE[type]);
    const list = [];
    if (q.length >= 3) list.push({ id: 'ask-ai', group: 'Ask', label: `Ask AI: “${q}”`, detail: 'Send to the AI Analyst with the current page context', kind: 'ai', run: () => askAbout(null, { prompt: q, autoSend: true }) });
    if (selectedAtOpen) {
      list.push({ id: 'ai-selection', group: 'Selected text', label: 'Ask AI about the selected text', detail: `“${selectedAtOpen.slice(0, 60)}${selectedAtOpen.length > 60 ? '…' : ''}”`, kind: 'ai', run: () => askAbout(selectedAtOpen, { from: `Selected on ${page}` }) });
      list.push({ id: 'nb-selection', group: 'Selected text', label: 'Add selected text to Notebook', detail: 'Appends with source and UTC time', kind: 'notebook', run: () => { notebook.addSnippet(selectedAtOpen, `${page} page`); notebook.open(); } });
    }
    list.push(
      { id: 'assistant', group: 'Actions', label: assistantOpen ? 'Close AI Analyst' : 'Open AI Analyst', detail: 'Uses the current page context', kbd: 'Alt A', kind: 'ai', run: toggleAssistant },
      { id: 'ai-settings', group: 'Actions', label: 'AI Analyst settings', detail: 'Style, privacy masking, context', kind: 'settings', run: () => { setAssistantOpen(true); setSettingsOpen(true); } },
      { id: 'notebook', group: 'Actions', label: notebookOpen ? 'Close Security Notebook' : 'Open Security Notebook', detail: 'Write and save investigation findings', kbd: 'Alt N', kind: 'notebook', run: toggleNotebook },
      { id: 'nb-new', group: 'Actions', label: 'New note', detail: 'Default template', kind: 'notebook', run: () => { notebook.createNote(); notebook.open(); } },
      ...TEMPLATE_LIST.filter((t) => t.id !== 'blank').map((t) => ({ id: `nb-tpl-${t.id}`, group: 'Actions', label: `New note: ${t.title}`, detail: t.desc, kind: 'notebook', run: () => { notebook.createNote(t.id); notebook.open(); } })),
      { id: 'nb-iocs', group: 'Actions', label: 'Extract indicators from the open note', detail: 'IPs, hashes, URLs, emails, CVEs', kind: 'ioc', run: () => { notebook.open(); notebook.setDrawer('iocs'); } },
      { id: 'nb-ref', group: 'Actions', label: 'Security reference', detail: 'Event IDs, ATT&CK techniques, logon types, TLP', kind: 'notebook', run: () => { notebook.open(); notebook.setDrawer('reference'); } },
      { id: 'nb-settings', group: 'Actions', label: 'Notebook settings', detail: 'Templates, TLP default, export, backup', kind: 'settings', run: () => { notebook.open(); notebook.setDrawer('settings'); } },
      { id: 'help', group: 'Actions', label: 'Keyboard shortcuts', detail: 'Ctrl / ⌘ /', kind: 'settings', run: () => setHelpOpen(true) },
      ...NAV_ITEMS.map(([label, route]) => ({ id: `nav-${route}`, group: 'Navigate', label: `Go to ${label}`, detail: 'Navigate', kind: 'navigation', run: () => go(route) })),
      ...notes.map((n) => ({ id: `note-${n.id}`, group: 'Notes', label: n.title || 'Untitled note', detail: `Note · ${tlpOf(n.tlp).label}${n.caseRef ? ` · ${n.caseRef}` : ''}`, kind: 'note', run: () => { notebook.setActive(n.id); notebook.open(); } })),
      ...(data.alerts || []).map((item) => ({ id: `alert-${item.id}`, group: 'Records', label: item.title, detail: `Alert · ${item.severity} · ${item.id}`, kind: 'alert', ...mk('alert')(item) })),
      ...(data.incidents || []).map((item) => ({ id: `incident-${item.id}`, group: 'Records', label: item.title, detail: `Incident · ${item.id}`, kind: 'incident', ...mk('incident')(item) })),
      ...(data.users || []).map((item) => ({ id: `user-${item.username}`, group: 'Records', label: item.username, detail: `User · risk ${item.risk}`, kind: 'user', ...mk('user')(item) })),
      ...(data.hosts || []).map((item) => ({ id: `host-${item.hostname}`, group: 'Records', label: item.hostname, detail: `Host · ${item.ip}`, kind: 'host', ...mk('host')(item) })),
      ...(data.rules || []).map((item) => ({ id: `rule-${item.id}`, group: 'Records', label: item.name, detail: `Rule · Event ${item.eventId} · ${item.id}`, kind: 'rule', ...mk('rule')(item) })),
    );
    return list;
  }, [paletteQuery, selectedAtOpen, assistantOpen, notebookOpen, notes, data.alerts, data.hosts, data.incidents, data.rules, data.users, go, page, askAbout, toggleAssistant, toggleNotebook, setAssistantOpen, setSettingsOpen]);

  const filtered = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return commands.filter((c) => c.group !== 'Ask').slice(0, 70);
    const score = (c) => { const l = c.label.toLowerCase(); return l.startsWith(q) ? 0 : l.includes(q) ? 1 : 2; };
    return commands.filter((c) => c.group === 'Ask' || `${c.label} ${c.detail} ${c.group}`.toLowerCase().includes(q)).map((c, i) => ({ c, i })).sort((a, b) => (a.c.group === 'Ask' ? -1 : 0) - (b.c.group === 'Ask' ? -1 : 0) || score(a.c) - score(b.c) || a.i - b.i).map((x) => x.c).slice(0, 70);
  }, [commands, paletteQuery]);

  // Context menu content: data-driven so every entry has a visible label, an accelerator and a handler.
  const item = contextMenu?.item || {};
  const type = contextMenu?.type;
  const route = ROUTES[type];
  const mainId = type === 'event' ? (item.eventId || item.id) : (item.id || item.username || item.hostname || item.name || item.eventId);
  const ip = item.ip || item.sourceIp;
  const menuItems = useMemo(() => {
    if (!contextMenu) return [];
    const ctx = contextOf(type, item);
    const out = [
      { id: 'explain', key: 'E', icon: Sparkles, label: 'Explain with AI', run: () => askAbout(null, { selection: ctx, prompt: suggestionsFor(type)[0] && ['alert', 'user', 'incident'].includes(type) ? suggestionsFor(type)[0] : 'Explain this in simple terms.', autoSend: true }) },
      { id: 'ai', key: 'A', icon: Bot, label: 'Open in AI Analyst', run: () => { setPageContext({ selection: ctx }); setAssistantOpen(true); } },
      { id: 'nb', key: 'N', icon: NotebookPen, label: 'Add evidence to Notebook', run: () => { notebook.addEvidence(ctx); } },
    ];
    if (ip) out.push({ id: 'ioc', key: 'I', icon: Crosshair, label: 'Add IP to IOC table', run: () => notebook.addIoc({ type: 'ipv4', value: ip, context: `${type} ${mainId ?? ''}`.trim(), source: 'Dashboard' }) });
    if (route) out.push({ id: 'go', key: 'G', icon: Activity, label: `Open ${route}`, run: () => go(route) });
    if (mainId) out.push({ id: 'copy', key: 'C', icon: Copy, label: 'Copy identifier', run: async () => { try { await navigator.clipboard.writeText(String(mainId)); } catch { /* Clipboard access can be blocked by browser permissions. */ } } });
    out.push({ id: 'json', key: 'J', icon: Braces, label: 'Copy summary as JSON', run: async () => { try { await navigator.clipboard.writeText(JSON.stringify(ctx, null, 2)); } catch { /* clipboard blocked */ } } });
    return out;
  }, [contextMenu, type, item, ip, route, mainId, go, askAbout, setPageContext, setAssistantOpen]);
  const runMenu = (m) => { closeMenu(); m.run(); };

  useEffect(() => {
    const onPalette = () => openPalette();
    const onContext = (e) => {
      const d = e.detail; const now = Date.now();
      const last = lastOpen.current;
      if (!d.palette && menuIsOpen.current && now - last.t < DEDUPE_MS && Math.abs((d.x || 0) - last.x) < 14 && Math.abs((d.y || 0) - last.y) < 14) return; // native + synthetic long-press can both fire while the first menu is still open; a deliberate re-open after closing is allowed
      lastOpen.current = { t: now, x: d.x || 0, y: d.y || 0 };
      setPaletteOpen(false); setPos(null);
      setContextMenu({ ...d });
    };
    const onKey = (e) => {
      const mac = isMac();
      const typing = /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '') || e.target?.isContentEditable;
      if (!typing && (mac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
      if (!typing && (mac ? e.metaKey : e.ctrlKey) && e.key === '/') { e.preventDefault(); setContextMenu(null); setPaletteOpen(false); setHelpOpen(true); return; }
      // Panel shortcuts work even while typing; Alt+letter does not insert text on Windows/Linux and is intercepted on macOS.
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyA') { e.preventDefault(); toggleAssistant(); return; }
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyN') { e.preventDefault(); toggleNotebook(); return; }
      // Keyboard path to the context menu (Menu key or Shift+F10) on whichever row or card has focus.
      if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && !typing) {
        const el = document.activeElement;
        if (el && el !== document.body) {
          const r = el.getBoundingClientRect();
          const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + Math.min(24, r.width / 2), clientY: r.top + Math.min(24, r.height / 2) });
          if (!el.dispatchEvent(ev)) e.preventDefault();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (contextMenu) { e.preventDefault(); closeMenu(); }
        else if (paletteOpen) { e.preventDefault(); closePalette(); }
        else if (helpOpen) { e.preventDefault(); closeHelp(); }
      }
    };
    window.addEventListener(PALETTE_EVENT, onPalette);
    window.addEventListener(CONTEXT_EVENT, onContext);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener(PALETTE_EVENT, onPalette); window.removeEventListener(CONTEXT_EVENT, onContext); document.removeEventListener('keydown', onKey); };
  }, [closeMenu, closePalette, closeHelp, contextMenu, openPalette, paletteOpen, helpOpen, toggleAssistant, toggleNotebook]);

  // Touch: long-press anywhere a right-click menu exists. iOS never fires `contextmenu` on long-press, so we synthesize it.
  useEffect(() => {
    let timer = null; let start = null; let swallow = false;
    const cancel = () => { clearTimeout(timer); timer = null; };
    const down = (e) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      start = { x: e.clientX, y: e.clientY }; const target = e.target;
      cancel();
      timer = setTimeout(() => {
        const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: start.x, clientY: start.y });
        if (!target.dispatchEvent(ev)) {
          swallow = true;
          const eat = (c) => { c.preventDefault(); c.stopPropagation(); document.removeEventListener('click', eat, true); swallow = false; };
          document.addEventListener('click', eat, true);
          setTimeout(() => { document.removeEventListener('click', eat, true); swallow = false; }, 700);
          navigator.vibrate?.(8);
        }
      }, 520);
    };
    const move = (e) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel(); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', cancel);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('scroll', cancel, true);
    return () => { cancel(); void swallow; document.removeEventListener('pointerdown', down); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', cancel); document.removeEventListener('pointercancel', cancel); document.removeEventListener('scroll', cancel, true); };
  }, []);

  useEffect(() => { if (paletteOpen) paletteInput.current?.focus(); }, [paletteOpen]);

  // Place the menu using its measured size: flip left/up when it would leave the screen; centre it for palette-origin opens.
  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const w = menuRef.current.offsetWidth; const h = menuRef.current.offsetHeight; const vw = window.innerWidth; const vh = window.innerHeight;
    let x = contextMenu.palette ? (vw - w) / 2 : contextMenu.x || 8; let y = contextMenu.palette ? Math.max(8, (vh - h) / 3) : contextMenu.y || 8;
    if (x + w > vw - 8) x = x - w; if (y + h > vh - 8) y = y - h;
    setPos({ x: Math.max(8, Math.min(x, vw - w - 8)), y: Math.max(8, Math.min(y, vh - h - 8)) });
  }, [contextMenu, menuItems.length]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    menuRef.current?.querySelector('button')?.focus();
    const outside = (e) => { if (!menuRef.current?.contains(e.target)) closeMenu(); };
    const reposition = () => closeMenu();
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); };
  }, [contextMenu, closeMenu]);

  const choose = (command) => { closePalette(); command?.run(); };
  const onMenuKey = (e) => {
    const nodes = [...e.currentTarget.querySelectorAll('button:not(:disabled)')]; const i = nodes.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); nodes[(i + (e.key === 'ArrowDown' ? 1 : nodes.length - 1)) % nodes.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); nodes[0]?.focus(); } else if (e.key === 'End') { e.preventDefault(); nodes[nodes.length - 1]?.focus(); }
    else if (e.key === 'Tab') closeMenu();
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { const m = menuItems.find((x) => x.key === e.key.toUpperCase()); if (m) { e.preventDefault(); runMenu(m); } }
  };
  const icon = (c) => (c.kind === 'navigation' ? <ArrowRight size={15} /> : c.kind === 'alert' ? <ShieldAlert size={15} /> : c.kind === 'user' ? <UserRound size={15} /> : c.kind === 'ai' ? <Sparkles size={15} /> : c.kind === 'notebook' ? <NotebookPen size={15} /> : c.kind === 'note' ? <FileText size={15} /> : c.kind === 'settings' ? <Settings size={15} /> : c.kind === 'ioc' ? <Crosshair size={15} /> : <FileSearch size={15} />);

  return <>
    {paletteOpen && <div className="ws-palette-shade" onMouseDown={(e) => e.target === e.currentTarget && closePalette()}>
      <section className="ws-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="ws-palette-search"><Search size={18} /><input ref={paletteInput} value={paletteQuery} onChange={(e) => { setPaletteQuery(e.target.value); setActive(0); }} onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((v) => Math.min(filtered.length - 1, v + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((v) => Math.max(0, v - 1)); }
          if (e.key === 'Enter') { e.preventDefault(); choose(filtered[active]); }
          if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
        }} placeholder="Search pages, records and notes, or type a question for the AI…" aria-label="Search commands and loaded records" /><kbd>ESC</kbd></div>
        <div className="ws-palette-meta"><span>COMMAND PALETTE</span><span>{filtered.length} results · loaded data and your notes only</span></div>
        <div className="ws-palette-results" role="listbox" aria-label="Commands and records">
          {filtered.length ? filtered.map((c, i) => <React.Fragment key={c.id}>
            {(i === 0 || filtered[i - 1].group !== c.group) && <div className="ws-group" role="presentation">{c.group}</div>}
            <button type="button" role="option" aria-selected={i === active} className={`ws-command ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => choose(c)}>
              <span className="ws-command-icon">{icon(c)}</span><span className="ws-command-copy"><b>{c.label}</b><small>{c.detail}</small></span>{c.kbd ? <kbd className="ws-kbd-hint">{c.kbd}</kbd> : <ArrowRight size={14} className="ws-command-arrow" />}
            </button></React.Fragment>) : <div className="ws-no-results">No matching commands or loaded records. Type three or more characters to ask the AI instead.</div>}
        </div>
        <footer className="ws-palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span><kbd>Esc</kbd> close</span></footer>
      </section>
    </div>}
    {helpOpen && <div className="ws-palette-shade" onMouseDown={(e) => e.target === e.currentTarget && closeHelp()}><section className="ws-shortcut-help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><header><div><Keyboard size={18} /><b>Keyboard shortcuts</b></div><button type="button" onClick={closeHelp} aria-label="Close shortcut help"><X size={17} /></button></header>
      {[['Open command palette', 'Ctrl / ⌘ K'], ['Show keyboard shortcuts', 'Ctrl / ⌘ /'], ['Open search', '/'], ['Toggle AI Analyst', 'Alt A'], ['Toggle Security Notebook', 'Alt N'], ['Open the menu for the focused row or card', 'Menu key / Shift F10'], ['Open the menu on touch screens', 'Long-press'], ['Pick a menu action', 'E A N I G C J'], ['Move a floating window', 'Alt + arrows'], ['Resize a floating window', 'Alt Shift + arrows'], ['Insert a block in a note, or a saved AI prompt', '/'], ['Move through suggestions', '↑ ↓'], ['Select highlighted item', 'Enter'], ['Close current overlay', 'Esc']].map(([l, k]) => <div className="ws-shortcut-row" key={l}><span>{l}</span><kbd>{k}</kbd></div>)}
      <p>Search results include only records already loaded in this dashboard, plus your notes. Select any text on a page to Ask AI or add it to the Notebook. Right-click supported rows for contextual actions.</p></section></div>}
    {contextMenu && <div ref={menuRef} className="ws-context-menu" style={{ left: pos?.x ?? contextMenu.x, top: pos?.y ?? contextMenu.y, visibility: pos ? 'visible' : 'hidden' }} role="menu" aria-label={`${contextMenu.type} actions`} onKeyDown={onMenuKey}>
      <div className="ws-context-head"><span>{contextMenu.type === 'rule' ? 'Detection rule' : contextMenu.type}</span><b>{labelOf(contextMenu.type, item)}</b></div>
      <div className="ws-context-facts">
        {contextMenu.type === 'alert' && <><span>Severity <b>{textOf(item.severity) || '—'}</b></span><span>Event ID <b>{textOf(item.eventId) || '—'}</b></span><span>User <b>{textOf(item.user) || '—'}</b></span><span>Time <b>{textOf(item.ts) || '—'}</b></span></>}
        {contextMenu.type === 'user' && <><span>Risk score <b>{textOf(item.risk) || '—'}</b></span><span>Department <b>{textOf(item.dept) || '—'}</b></span></>}
        {contextMenu.type === 'host' && <><span>IP address <b>{textOf(item.ip) || '—'}</b></span><span>Status <b>{textOf(item.status) || '—'}</b></span></>}
        {contextMenu.type === 'rule' && <><span>Event ID <b>{textOf(item.eventId) || '—'}</b></span><span>Severity <b>{textOf(item.severity) || '—'}</b></span></>}
        {contextMenu.type === 'event' && <><span>Event ID <b>{textOf(item.eventId) || '—'}</b></span><span>Time <b>{textOf(item.ts) || '—'}</b></span><span>Description <b>{textOf(item.desc) || '—'}</b></span></>}
        {contextMenu.type === 'incident' && <><span>Severity <b>{textOf(item.severity) || '—'}</b></span><span>Status <b>{textOf(item.status) || '—'}</b></span></>}
      </div>
      <div className="ws-context-actions">
        {menuItems.map((m) => { const I = m.icon; return <button key={m.id} type="button" role="menuitem" aria-keyshortcuts={m.key} onClick={() => runMenu(m)}><I size={15} /> <span>{m.label}</span><kbd>{m.key}</kbd></button>; })}
      </div>
    </div>}
    <SelectionToolbar page={page} />
  </>;
}
