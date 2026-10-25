import React, { useMemo, useRef, useState } from 'react';
import { Check, Copy, CopyPlus, Crosshair, Download, ExternalLink, FileText, History, Library, Pin, PinOff, Plus, Search, Settings, Trash2, Upload, Undo2, LayoutTemplate, PanelLeftClose, PanelRightClose, RotateCcw, Maximize2, X } from 'lucide-react';
import { Segmented, Switch } from '../assistant/controls';
import { notebook, useNotebook, activeNoteOf, DEFAULT_SETTINGS } from '../../notebook/notebookStore';
import { TEMPLATE_LIST } from '../../notebook/templates';
import { TLP, tlpOf, EVENT_IDS, TECHNIQUES, LOGON_TYPES, CHECKLISTS, techniqueUrl, STATUSES } from '../../notebook/securityKB';
import { checklistHtml } from '../../notebook/blocks';
import { escapeHtml, htmlToText } from '../../notebook/sanitize';
import { extractEntities, defang, ENTITY_LABEL } from '../../notebook/entities';
import { iocCsv, safeFile } from '../../notebook/exporters';
import { downloadText, copyToClipboard } from '../../notebook/download';

export const TABS = [['notes', 'Notes', FileText], ['templates', 'Templates', LayoutTemplate], ['reference', 'Reference', Library], ['iocs', 'IOCs', Crosshair], ['history', 'History', History], ['settings', 'Settings', Settings]];
const ago = (ts) => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
export const TlpBadge = ({ id }) => <span className={`tlp-badge tlp-${id.replace('+', '-')}`}>{tlpOf(id).label}</span>;

function CopyBtn({ value, label }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="sn-row-btn" aria-label={label || `Copy ${value}`} title={label || `Copy ${value}`} onClick={async () => { if (await copyToClipboard(value)) { setDone(true); setTimeout(() => setDone(false), 1400); } }}>{done ? <Check size={13} /> : <Copy size={13} />}</button>;
}

function NotesPanel({ onClose }) {
  const notes = useNotebook((s) => s.notes); const activeId = useNotebook((s) => s.activeId);
  const [q, setQ] = useState(''); const [tag, setTag] = useState(''); const [tlp, setTlp] = useState('');
  const hay = useMemo(() => new Map(notes.map((n) => [n.id, `${n.title} ${n.caseRef} ${n.tags.join(' ')} ${htmlToText(n.html)}`.toLowerCase()])), [notes]);
  const tags = useMemo(() => { const c = {}; notes.forEach((n) => n.tags.forEach((t) => { c[t] = (c[t] || 0) + 1; })); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t); }, [notes]);
  const shown = notes.filter((n) => (!q || hay.get(n.id).includes(q.toLowerCase())) && (!tag || n.tags.includes(tag)) && (!tlp || n.tlp === tlp)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  return (
    <div className="nb-pane">
      <div className="nb-search"><Search size={14} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, tags, case IDs…" aria-label="Search notes" /></div>
      <div className="nb-filters">
        <select aria-label="Filter by TLP" value={tlp} onChange={(e) => setTlp(e.target.value)}><option value="">All TLP</option>{TLP.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        {tags.map((t) => <button key={t} type="button" className={`nb-tag ${tag === t ? 'on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? '' : t)}>#{t}</button>)}
      </div>
      <ul className="nb-list" aria-label="Notes">
        {shown.map((n) => (
          <li key={n.id} className={n.id === activeId ? 'active' : ''}>
            <button type="button" className="nb-open" onClick={() => { notebook.setActive(n.id); onClose(); }} aria-current={n.id === activeId}>
              <span className="nb-title">{n.pinned && <Pin size={11} aria-hidden="true" />}<b>{n.title || 'Untitled note'}</b></span>
              <span className="nb-sub"><TlpBadge id={n.tlp} />{n.caseRef && <span>{n.caseRef}</span>}<span>{STATUSES.find((s) => s[0] === n.status)?.[1]}</span><span>{ago(n.updatedAt)}</span></span>
              {n.tags.length > 0 && <span className="nb-tags">{n.tags.map((t) => `#${t}`).join(' ')}</span>}
            </button>
            <span className="nb-row-actions">
              <button type="button" className="sn-row-btn" onClick={() => notebook.togglePin(n.id)} aria-label={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`} title={n.pinned ? 'Unpin' : 'Pin to top'}>{n.pinned ? <PinOff size={13} /> : <Pin size={13} />}</button>
              <button type="button" className="sn-row-btn" onClick={() => notebook.duplicateNote(n.id)} aria-label={`Duplicate ${n.title}`} title="Duplicate"><CopyPlus size={13} /></button>
              <button type="button" className="sn-row-btn danger" onClick={() => notebook.deleteNote(n.id)} aria-label={`Delete ${n.title}`} title="Move to Recently deleted"><Trash2 size={13} /></button>
            </span>
          </li>
        ))}
        {!shown.length && <li className="nb-empty">No notes match.</li>}
      </ul>
    </div>
  );
}

function TemplatesPanel({ onClose }) {
  const groups = TEMPLATE_LIST.reduce((m, t) => { (m[t.group] = m[t.group] || []).push(t); return m; }, {});
  return (
    <div className="nb-pane">
      {Object.entries(groups).map(([g, list]) => (
        <section key={g}><h4 className="nb-h">{g}</h4>
          <ul className="nb-list">{list.map((t) => <li key={t.id}><button type="button" className="nb-open" onClick={() => { notebook.createNote(t.id); onClose(); }}><span className="nb-title"><Plus size={12} aria-hidden="true" /><b>{t.title}</b></span><span className="nb-sub">{t.desc}</span></button></li>)}</ul>
        </section>
      ))}
    </div>
  );
}

function ReferencePanel({ insert }) {
  const [sub, setSub] = useState('events'); const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const subs = [['events', 'Event IDs'], ['attack', 'ATT&CK'], ['logon', 'Logon types'], ['tlp', 'TLP'], ['lists', 'Checklists']];
  const active = useNotebook((st) => activeNoteOf(st));
  return (
    <div className="nb-pane">
      <div className="nb-subtabs" role="tablist" aria-label="Reference sections">{subs.map(([id, t]) => <button key={id} type="button" role="tab" aria-selected={sub === id} className={sub === id ? 'on' : ''} onClick={() => { setSub(id); setQ(''); }}>{t}</button>)}</div>
      {(sub === 'events' || sub === 'attack') && <div className="nb-search"><Search size={14} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={sub === 'events' ? 'Search event ID or name…' : 'Search technique ID or name…'} aria-label="Search reference" /></div>}
      <ul className="nb-list nb-ref">
        {sub === 'events' && EVENT_IDS.filter((e) => !s || `${e.id} ${e.name} ${e.why}`.toLowerCase().includes(s)).map((e) => (
          <li key={e.id}><div className="nb-ref-main"><b>{e.id}</b><span>{e.name}</span><small>{e.log} log</small><p>{e.why}</p>{e.attack.length > 0 && <p className="nb-chips">{e.attack.map((t) => <button key={t} type="button" onClick={() => insert(`<p>${escapeHtml(t)}</p>`)} title={`Insert ${t}`}>{t}</button>)}</p>}</div>
            <span className="nb-row-actions"><button type="button" className="sn-row-btn" onClick={() => insert(`<p><strong>${e.id}</strong> ${escapeHtml(e.name)}</p>`)} aria-label={`Insert event ${e.id}`} title="Insert in note"><Plus size={13} /></button><CopyBtn value={e.id} /></span></li>
        ))}
        {sub === 'attack' && TECHNIQUES.filter((t) => !s || `${t.id} ${t.name} ${t.tactic}`.toLowerCase().includes(s)).map((t) => (
          <li key={t.id}><div className="nb-ref-main"><b>{t.id}</b><span>{t.name}</span><small>{t.tactic}</small></div>
            <span className="nb-row-actions"><button type="button" className="sn-row-btn" onClick={() => insert(`<p><strong>${t.id}</strong> ${escapeHtml(t.name)}</p>`)} aria-label={`Insert ${t.id}`} title="Insert in note"><Plus size={13} /></button><a className="sn-row-btn" href={techniqueUrl(t.id)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${t.id} on MITRE ATT&CK`} title="Open on attack.mitre.org"><ExternalLink size={13} /></a></span></li>
        ))}
        {sub === 'logon' && LOGON_TYPES.map(([n, name, d]) => <li key={n}><div className="nb-ref-main"><b>Type {n}</b><span>{name}</span><p>{d}</p></div><span className="nb-row-actions"><button type="button" className="sn-row-btn" onClick={() => insert(`<p>Logon type ${n} (${escapeHtml(name)})</p>`)} aria-label={`Insert logon type ${n}`}><Plus size={13} /></button></span></li>)}
        {sub === 'tlp' && TLP.map((t) => <li key={t.id}><div className="nb-ref-main"><TlpBadge id={t.id} /><p>{t.hint}</p></div><span className="nb-row-actions"><button type="button" className="nb-text-btn" aria-pressed={active?.tlp === t.id} onClick={() => active && notebook.updateNote(active.id, { tlp: t.id })}>{active?.tlp === t.id ? 'Current' : 'Set on note'}</button></span></li>)}
        {sub === 'lists' && Object.entries(CHECKLISTS).map(([k, c]) => <li key={k}><div className="nb-ref-main"><b>{c.title}</b><p>{c.items.length} items</p></div><span className="nb-row-actions"><button type="button" className="nb-text-btn" onClick={() => insert(checklistHtml(k))}>Insert</button></span></li>)}
      </ul>
      <p className="nb-foot">Orientation only. Verify against MITRE ATT&CK and Microsoft documentation; matrices and event semantics change between versions.</p>
    </div>
  );
}

function IocPanel({ settings }) {
  const note = useNotebook((st) => activeNoteOf(st));
  const [df, setDf] = useState(settings.defangExports); const [filter, setFilter] = useState('');
  const all = useMemo(() => extractEntities(htmlToText(note?.html || '')), [note?.html]);
  const types = [...new Set(all.map((e) => e.type))];
  const list = all.filter((e) => !filter || e.type === filter);
  const show = (e) => (df ? defang(e.value, e.type) : e.value);
  const addable = (e) => ['ipv4', 'url', 'hash', 'email'].includes(e.type);
  return (
    <div className="nb-pane">
      <p className="nb-intro">Indicators found in this note. Extraction runs in your browser; confirm each one before acting on it.</p>
      <div className="nb-filters">
        <select aria-label="Filter indicator type" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All types ({all.length})</option>{types.map((t) => <option key={t} value={t}>{ENTITY_LABEL[t]}</option>)}</select>
        <label className="nb-check"><input type="checkbox" checked={df} onChange={(e) => setDf(e.target.checked)} /> Defang when copying</label>
      </div>
      <ul className="nb-list nb-ref" aria-label="Indicators">
        {list.map((e) => (
          <li key={`${e.type}:${e.value}`}><div className="nb-ref-main"><span className="nb-ioc-type">{e.type === 'hash' ? e.subtype : ENTITY_LABEL[e.type]}</span><code>{show(e)}</code><small>{e.count > 1 ? `${e.count} mentions` : '1 mention'}{e.subtype === 'private' ? ' · private range' : ''}</small></div>
            <span className="nb-row-actions"><CopyBtn value={show(e)} />{addable(e) && <button type="button" className="sn-row-btn" aria-label={`Add ${e.value} to IOC table`} title="Add to the note's IOC table" onClick={() => notebook.addIoc({ type: e.type, value: e.value, source: 'Note' })}><Plus size={13} /></button>}</span></li>
        ))}
        {!list.length && <li className="nb-empty">No indicators found. IPv4 addresses, hashes, URLs, emails, CVEs, ATT&CK IDs, SIDs and event IDs are detected.</li>}
      </ul>
      {list.length > 0 && <div className="ctl-btns"><button type="button" onClick={() => copyToClipboard(list.map(show).join('\n'))}><Copy size={13} /> Copy all</button><button type="button" onClick={() => downloadText(`${safeFile(note.title)}-iocs.csv`, iocCsv(list, { defangIocs: df }), 'csv')}><Download size={13} /> CSV</button></div>}
    </div>
  );
}

function HistoryPanel() {
  const note = useNotebook((st) => activeNoteOf(st)); const trash = useNotebook((st) => st.trash);
  return (
    <div className="nb-pane">
      <div className="nb-row-head"><h4 className="nb-h">Versions of this note</h4><button type="button" className="nb-text-btn" onClick={() => notebook.snapshot(note.id)}>Save snapshot</button></div>
      <ul className="nb-list" aria-label="Versions">
        {note.versions.map((v) => <li key={v.id}><div className="nb-ref-main"><b>{v.label || 'Snapshot'}</b><small>{ago(v.ts)} · {htmlToText(v.html).length} chars</small></div><span className="nb-row-actions"><button type="button" className="nb-text-btn" onClick={() => notebook.restoreVersion(note.id, v.id)}><Undo2 size={12} /> Restore</button></span></li>)}
        {!note.versions.length && <li className="nb-empty">No snapshots yet. Snapshots are saved automatically before AI replacements, restores and long editing sessions.</li>}
      </ul>
      <div className="nb-row-head"><h4 className="nb-h">Recently deleted</h4>{trash.length > 0 && <button type="button" className="nb-text-btn danger" onClick={notebook.emptyTrash}>Empty</button>}</div>
      <ul className="nb-list" aria-label="Recently deleted notes">
        {trash.map((n) => <li key={n.id}><div className="nb-ref-main"><b>{n.title}</b><small>Deleted {ago(n.deletedAt)}</small></div><span className="nb-row-actions"><button type="button" className="nb-text-btn" onClick={() => notebook.restoreNote(n.id)}>Restore</button><button type="button" className="sn-row-btn danger" onClick={() => notebook.purge(n.id)} aria-label={`Delete ${n.title} permanently`}><X size={13} /></button></span></li>)}
        {!trash.length && <li className="nb-empty">Nothing deleted.</li>}
      </ul>
    </div>
  );
}

function SettingsPanel({ settings, floating }) {
  const file = useRef(null); const [msg, setMsg] = useState('');
  const used = notebook.storageBytes(); const pct = Math.min(100, Math.round((used / (5 * 1024 * 1024)) * 100));
  const set = (patch) => notebook.updateSettings(patch);
  const doImport = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try { setMsg(`Imported ${notebook.importBackup(await f.text())} note(s).`); } catch (err) { setMsg(err.message); }
  };
  return (
    <div className="nb-pane nb-settings">
      <section><h4>New notes</h4>
        <div className="ctl-row"><label className="ctl-label" htmlFor="nb-def-tpl">Default template</label><select id="nb-def-tpl" value={settings.defaultTemplate} onChange={(e) => set({ defaultTemplate: e.target.value })}>{TEMPLATE_LIST.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
        <div className="ctl-row"><label className="ctl-label" htmlFor="nb-def-tlp">Default TLP</label><select id="nb-def-tlp" value={settings.defaultTlp} onChange={(e) => set({ defaultTlp: e.target.value })}>{TLP.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
        <Switch label="UTC timestamps" hint="Inserted timestamps use UTC, the standard for incident timelines." checked={settings.utcTimestamps} onChange={(v) => set({ utcTimestamps: v })} />
      </section>
      <section><h4>Editor</h4>
        <Segmented label="Text size" value={settings.fontSize} onChange={(v) => set({ fontSize: v })} options={[['small', 'S'], ['medium', 'M'], ['large', 'L']]} />
        <Segmented label="Line width" value={settings.width} onChange={(v) => set({ width: v })} options={[['comfortable', 'Comfortable'], ['wide', 'Wide']]} />
        <Switch label="Spell check" checked={settings.spellcheck} onChange={(v) => set({ spellcheck: v })} />
        <Switch label="Word and character count" checked={settings.showCounts} onChange={(v) => set({ showCounts: v })} />
        <Switch label="Automatic snapshots" hint="Keeps up to 10 earlier versions of each note." checked={settings.autoSnapshot} onChange={(v) => set({ autoSnapshot: v })} />
      </section>
      <section><h4>Sharing and export</h4>
        <Switch label="Defang indicators in exports" hint="http becomes hxxp, dots in IPs and URLs become [.]." checked={settings.defangExports} onChange={(v) => set({ defangExports: v })} />
        <Switch label="TLP banner in exports" checked={settings.tlpBanner} onChange={(v) => set({ tlpBanner: v })} />
      </section>
      <section><h4>Storage and backup</h4>
        <div className="nb-meter" role="img" aria-label={`Browser storage used by the notebook: ${pct} percent of an estimated 5 megabytes`}><i style={{ width: `${Math.max(2, pct)}%` }} className={pct > 80 ? 'warn' : ''} /></div>
        <small className="ctl-note">{(used / 1024).toFixed(0)} KB used of roughly 5 MB browser storage.{pct > 80 ? ' Almost full: download a backup and delete old notes.' : ''} Notes live only in this browser; export a backup to move or protect them.</small>
        <div className="ctl-btns"><button type="button" onClick={() => downloadText(`cyber-dna-notebook-backup-${new Date().toISOString().slice(0, 10)}.json`, notebook.exportBackup(), 'json')}><Download size={13} /> Export all notes</button><button type="button" onClick={() => file.current?.click()}><Upload size={13} /> Import backup</button></div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={doImport} aria-label="Import notebook backup file" />
        {msg && <small className="ctl-note" role="status">{msg}</small>}
      </section>
      <section><h4>Window</h4>
        <div className="ctl-btns">
          <button type="button" onClick={() => floating.dock('left')}><PanelLeftClose size={14} /> Dock left</button>
          <button type="button" onClick={() => floating.dock('right')}><PanelRightClose size={14} /> Dock right</button>
          <button type="button" onClick={floating.toggleMaximize}><Maximize2 size={14} /> {floating.maximized ? 'Restore size' : 'Maximize'}</button>
          <button type="button" onClick={floating.reset}><RotateCcw size={14} /> Reset position</button>
        </div>
        <small className="ctl-note">Move with Alt + arrow keys, resize with Alt + Shift + arrows.</small>
        <div className="ctl-btns"><button type="button" onClick={() => set({ ...DEFAULT_SETTINGS })}><RotateCcw size={13} /> Reset notebook settings</button></div>
      </section>
    </div>
  );
}

export default function NotebookDrawer({ tab, onTab, onClose, settings, insert, floating }) {
  return (
    <aside className="nb-drawer" aria-label="Notebook library" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <div className="nb-tabs" role="tablist" aria-label="Notebook sections">
        {TABS.map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => onTab(id)} title={label}><Icon size={14} aria-hidden="true" /><span>{label}</span></button>)}
        <button type="button" className="sn-icon nb-close" onClick={onClose} aria-label="Close library"><X size={15} /></button>
      </div>
      <div className="nb-body" role="tabpanel">
        {tab === 'notes' && <NotesPanel onClose={onClose} />}
        {tab === 'templates' && <TemplatesPanel onClose={onClose} />}
        {tab === 'reference' && <ReferencePanel insert={insert} />}
        {tab === 'iocs' && <IocPanel settings={settings} />}
        {tab === 'history' && <HistoryPanel />}
        {tab === 'settings' && <SettingsPanel settings={settings} floating={floating} />}
      </div>
    </aside>
  );
}
