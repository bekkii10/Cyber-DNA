import { createStore } from '../lib/createStore';
import { cleanHtml, htmlToText } from './sanitize';
import { TEMPLATES, templateById } from './templates';
import { TLP, STATUSES } from './securityKB';
import { IOC_HEADERS, evidenceCard, snippetCard } from './blocks';
import { escapeHtml } from './sanitize';
import { backupJson } from './exporters';

export const NOTES_KEY = 'cyberdna-security-notebook-v1'; // unchanged so existing notes keep loading
export const ACTIVE_KEY = `${NOTES_KEY}-active`;
export const SETTINGS_KEY = 'cyberdna-notebook-settings-v1';
export const TRASH_KEY = 'cyberdna-notebook-trash-v1';
export const MAX_VERSIONS = 10;
const AUTO_VERSION_MS = 10 * 60 * 1000;
const SAVE_DELAY = 400;

export const DEFAULT_SETTINGS = { defaultTemplate: 'investigation', defaultTlp: 'AMBER', fontSize: 'medium', width: 'comfortable', spellcheck: true, showCounts: true, utcTimestamps: true, defangExports: false, tlpBanner: true, autoSnapshot: true };

const read = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; } catch { return fallback; } };
const rid = () => Math.random().toString(36).slice(2, 7);
const tlpIds = TLP.map((t) => t.id);
const statusIds = STATUSES.map((s) => s[0]);

export function normalizeNote(n, settings = DEFAULT_SETTINGS) {
  const now = Date.now();
  return {
    id: String(n.id || `note-${now}-${rid()}`),
    title: String(n.title ?? 'Untitled note').slice(0, 200),
    html: cleanHtml(n.html),
    createdAt: Number(n.createdAt) || Number(n.updatedAt) || now,
    updatedAt: Number(n.updatedAt) || now,
    tags: Array.isArray(n.tags) ? [...new Set(n.tags.map((t) => String(t).trim().replace(/^#/, '').slice(0, 30)).filter(Boolean))].slice(0, 12) : [],
    tlp: tlpIds.includes(n.tlp) ? n.tlp : settings.defaultTlp,
    status: statusIds.includes(n.status) ? n.status : 'draft',
    pinned: !!n.pinned,
    caseRef: String(n.caseRef || '').slice(0, 60),
    versions: Array.isArray(n.versions) ? n.versions.slice(0, MAX_VERSIONS).map((v) => ({ id: String(v.id), ts: Number(v.ts) || now, label: String(v.label || ''), title: String(v.title || ''), html: cleanHtml(v.html) })) : [],
  };
}

export const makeNote = (templateId, settings = DEFAULT_SETTINGS, extra = {}) => {
  const t = templateById(templateId);
  const now = Date.now();
  return normalizeNote({ id: `note-${now}-${rid()}`, title: t.title, html: t.html, createdAt: now, updatedAt: now, ...extra }, settings);
};

function load() {
  const settings = { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
  const stored = read(NOTES_KEY, null);
  let notes = Array.isArray(stored) && stored.length ? stored.map((n) => normalizeNote(n, settings)) : [makeNote(settings.defaultTemplate, settings, { title: 'New security investigation' })];
  const trash = (read(TRASH_KEY, []) || []).filter((n) => n && n.id).map((n) => ({ ...normalizeNote(n, settings), deletedAt: Number(n.deletedAt) || Date.now() }));
  let activeId = ''; try { activeId = localStorage.getItem(ACTIVE_KEY) || ''; } catch { /* storage unavailable */ }
  if (!notes.some((n) => n.id === activeId)) activeId = notes[0].id;
  return { notes, trash, settings, activeId, open: false, drawer: null, rev: 0, saveState: 'saved', lastSavedAt: Date.now(), lastAutoVersion: {} };
}

export const store = createStore(load());
let timer = null;

function persistNow() {
  clearTimeout(timer); timer = null;
  const s = store.get();
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(s.notes));
    localStorage.setItem(ACTIVE_KEY, s.activeId);
    localStorage.setItem(TRASH_KEY, JSON.stringify(s.trash));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s.settings));
    if (s.saveState !== 'saved') store.set({ saveState: 'saved', lastSavedAt: Date.now() });
  } catch { store.set({ saveState: 'error' }); }
}
function schedule() { store.set({ saveState: 'saving' }); clearTimeout(timer); timer = setTimeout(persistNow, SAVE_DELAY); }
export const flush = persistNow;
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (timer) persistNow(); });

const patchNote = (notes, id, fn) => notes.map((n) => (n.id === id ? fn(n) : n));
const withVersion = (n, label) => ({ ...n, versions: [{ id: `v-${Date.now()}-${rid()}`, ts: Date.now(), label, title: n.title, html: n.html }, ...n.versions].slice(0, MAX_VERSIONS) });

export const notebook = {
  open: () => store.set({ open: true }),
  close: () => store.set({ open: false }),
  toggle: () => store.set((s) => ({ ...s, open: !s.open })),
  setDrawer: (drawer) => store.set({ drawer }),
  setActive(id) { store.set({ activeId: id }); schedule(); },

  createNote(templateId, extra = {}) {
    const s = store.get();
    const n = makeNote(templateId || s.settings.defaultTemplate, s.settings, extra);
    store.set({ notes: [n, ...s.notes], activeId: n.id });
    persistNow();
    return n;
  },
  updateNote(id, patch) {
    store.set((s) => {
      const due = 'html' in patch && s.settings.autoSnapshot && Date.now() - (s.lastAutoVersion[id] || 0) > AUTO_VERSION_MS;
      let stamped = s.lastAutoVersion;
      const notes = patchNote(s.notes, id, (n) => {
        let base = n; // snapshot captures the content *before* this edit
        if (due && n.html !== patch.html && htmlToText(n.html).length > 40) { base = withVersion(n, 'Automatic snapshot'); stamped = { ...s.lastAutoVersion, [id]: Date.now() }; }
        return { ...base, ...patch, updatedAt: Date.now() };
      });
      return { ...s, notes, lastAutoVersion: stamped };
    });
    schedule();
  },
  snapshot(id, label = 'Manual snapshot') { store.set((s) => ({ ...s, notes: patchNote(s.notes, id, (n) => withVersion(n, label)) })); persistNow(); },
  restoreVersion(id, versionId) {
    store.set((s) => ({ ...s, rev: s.rev + 1, notes: patchNote(s.notes, id, (n) => {
      const v = n.versions.find((x) => x.id === versionId); if (!v) return n;
      const saved = withVersion(n, 'Before restore');
      return { ...saved, title: v.title || n.title, html: v.html, updatedAt: Date.now() };
    }) }));
    persistNow();
  },
  deleteNote(id) {
    const s = store.get(); const gone = s.notes.find((n) => n.id === id); if (!gone) return null;
    let notes = s.notes.filter((n) => n.id !== id);
    if (!notes.length) notes = [makeNote(s.settings.defaultTemplate, s.settings, { title: 'New security investigation' })];
    store.set({ notes, trash: [{ ...gone, deletedAt: Date.now() }, ...s.trash].slice(0, 30), activeId: s.activeId === id ? notes[0].id : s.activeId, rev: s.rev + 1 });
    persistNow();
    return gone;
  },
  restoreNote(id) {
    const s = store.get(); const n = s.trash.find((x) => x.id === id); if (!n) return;
    const { deletedAt, ...rest } = n; void deletedAt;
    store.set({ notes: [rest, ...s.notes], trash: s.trash.filter((x) => x.id !== id), activeId: n.id, rev: s.rev + 1 }); persistNow();
  },
  purge(id) { store.set((s) => ({ ...s, trash: s.trash.filter((x) => x.id !== id) })); persistNow(); },
  emptyTrash() { store.set({ trash: [] }); persistNow(); },
  duplicateNote(id) {
    const s = store.get(); const src = s.notes.find((n) => n.id === id); if (!src) return null;
    const n = normalizeNote({ ...src, id: undefined, title: `${src.title} (copy)`, versions: [], pinned: false, createdAt: Date.now(), updatedAt: Date.now() }, s.settings);
    store.set({ notes: [n, ...s.notes], activeId: n.id }); persistNow(); return n;
  },
  togglePin(id) { store.set((s) => ({ ...s, notes: patchNote(s.notes, id, (n) => ({ ...n, pinned: !n.pinned })) })); persistNow(); },

  // Append content to the active note from anywhere (context menu, selection toolbar, AI answers). The editor re-syncs via `rev`.
  appendHtml(html, { open = true } = {}) {
    const s = store.get(); const id = s.activeId;
    store.set({ notes: patchNote(s.notes, id, (n) => ({ ...n, html: cleanHtml(`${n.html}${html}`), updatedAt: Date.now() })), rev: s.rev + 1, ...(open ? { open: true } : {}) });
    persistNow();
  },
  addEvidence(ctx) { notebook.appendHtml(evidenceCard(ctx)); },
  addSnippet(text, source) { notebook.appendHtml(snippetCard(text, source)); },
  addIoc({ type, value, context = '', source = 'Dashboard' }) {
    const s = store.get(); const n = s.notes.find((x) => x.id === s.activeId); if (!n) return;
    const doc = new DOMParser().parseFromString(n.html, 'text/html');
    const t = [...doc.querySelectorAll('table')].find((tb) => { const c = [...tb.querySelectorAll('tr')[0]?.children || []].map((x) => x.textContent.trim()); return c[0] === IOC_HEADERS[0] && c[1] === IOC_HEADERS[1]; });
    const row = [type, value, context, '', source].map((v) => `<td>${escapeHtml(v)}</td>`).join('');
    if (t) {
      const empty = [...t.querySelectorAll('tr')].slice(1).find((tr) => [...tr.children].every((c) => !c.textContent.trim()));
      if (empty) empty.innerHTML = row; else t.querySelector('tbody').insertAdjacentHTML('beforeend', `<tr>${row}</tr>`);
      notebook.setHtml(doc.body.innerHTML);
    } else {
      notebook.appendHtml(`<h3>Indicators</h3><table><tbody><tr>${IOC_HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr><tr>${row}</tr></tbody></table><p></p>`, { open: false });
    }
    store.set({ open: true });
  },
  setHtml(html) { const s = store.get(); store.set({ notes: patchNote(s.notes, s.activeId, (n) => ({ ...n, html: cleanHtml(html), updatedAt: Date.now() })), rev: s.rev + 1 }); persistNow(); },

  exportBackup: () => backupJson(store.get().notes),
  importBackup(text) {
    let data; try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
    const list = Array.isArray(data) ? data : data?.notes;
    if (!Array.isArray(list) || !list.length) throw new Error('No notes found in that file.');
    const s = store.get(); const ids = new Set(s.notes.map((n) => n.id));
    const imported = list.slice(0, 200).map((n) => { const x = normalizeNote(n, s.settings); if (ids.has(x.id)) x.id = `note-${Date.now()}-${rid()}`; ids.add(x.id); return x; });
    store.set({ notes: [...imported, ...s.notes], activeId: imported[0].id, rev: s.rev + 1 }); persistNow();
    return imported.length;
  },
  updateSettings(patch) { store.set((s) => ({ ...s, settings: { ...s.settings, ...patch } })); persistNow(); },
  storageBytes() { try { return [NOTES_KEY, TRASH_KEY, SETTINGS_KEY].reduce((a, k) => a + (localStorage.getItem(k) || '').length * 2, 0); } catch { return 0; } },
  reload() { clearTimeout(timer); store.set(load()); },
};

export { TEMPLATES };

import { useStore } from '../lib/createStore';
export const useNotebook = (selector) => useStore(store, selector);
export const activeNoteOf = (s) => s.notes.find((n) => n.id === s.activeId) || s.notes[0];
