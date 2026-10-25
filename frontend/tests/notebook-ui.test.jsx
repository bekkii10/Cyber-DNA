// Notebook UI against the real Tiptap editor in jsdom. AI calls use a stubbed fetch speaking the PROPOSED /assistant/chat contract.
import React from 'react';
import { render, screen, cleanup, waitFor, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantProvider } from '../src/components/assistant/AssistantProvider';
import NotebookLauncher from '../src/components/notebook/NotebookLauncher';
import { NOTEBOOK_INSERT_EVENT, NOTEBOOK_OPEN_EVENT } from '../src/components/interactions/events';
import { notebook, store, flush, NOTES_KEY } from '../src/notebook/notebookStore';
import { setAiSettings, resetAiSettings } from '../src/components/assistant/assistantSettings';

const json = (b) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => b });
const bodies = () => global.fetch.mock.calls.map(([, o]) => JSON.parse(o.body));
let user;
async function openNotebook() {
  user = userEvent.setup();
  render(<AssistantProvider page="Alerts"><NotebookLauncher /></AssistantProvider>);
  await user.click(screen.getByRole('button', { name: 'Open Security Notebook' }));
  return screen.findByRole('textbox', { name: 'Security investigation note' });
}
const setBody = (html) => { notebook.setHtml(html); };

beforeEach(() => { localStorage.clear(); notebook.reload(); resetAiSettings(); global.fetch = vi.fn(); sessionStorage.setItem('cyberdna-token', 't'); });
afterEach(cleanup);

describe('notebook window', () => {
  test('lazy-loads on first open, shows the template, and autosaves typing to browser storage', async () => {
    const ed = await openNotebook();
    expect(ed.innerHTML).toContain('Investigation notes');
    await user.click(ed); await user.keyboard('Analyst observation');
    await waitFor(() => expect(localStorage.getItem(NOTES_KEY)).toContain('Analyst observation'), { timeout: 2000 });
  });

  test('closing returns focus to the launcher; Alt-arrow moves the window without a mouse', async () => {
    await openNotebook();
    const win = screen.getByRole('region', { name: 'Security Notebook' });
    const left0 = parseInt(win.style.left, 10); const top0 = parseInt(win.style.top, 10);
    fireEvent.keyDown(screen.getByLabelText(/Security Notebook window/), { key: 'ArrowRight', altKey: true });
    fireEvent.keyDown(screen.getByLabelText(/Security Notebook window/), { key: 'ArrowDown', altKey: true });
    expect(parseInt(win.style.left, 10)).toBe(left0 + 24);
    expect(parseInt(win.style.top, 10)).toBe(Math.min(top0 + 24, window.innerHeight - parseInt(win.style.height, 10) - 8)); // never leaves the screen
    const w0 = parseInt(win.style.width, 10);
    fireEvent.keyDown(screen.getByLabelText(/Security Notebook window/), { key: 'ArrowLeft', altKey: true, shiftKey: true });
    expect(parseInt(win.style.width, 10)).toBe(w0 - 24);
    await user.click(screen.getByRole('button', { name: 'Close notebook' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open Security Notebook' })));
  });

  test('creates a note from the New menu with a template; title, content, TLP default and status come through', async () => {
    await openNotebook();
    await user.click(screen.getByRole('button', { name: 'New note' }));
    await user.click(await screen.findByRole('menuitem', { name: /Credential attack review/ }));
    expect(screen.getByRole('textbox', { name: 'Note title' }).value).toBe('Credential attack review');
    expect(screen.getByRole('textbox', { name: 'Security investigation note' }).innerHTML).toContain('Failed logons');
    expect(screen.getByRole('combobox', { name: 'TLP marking' }).value).toBe('AMBER');
  });

  test('TLP, status, case ID and tags are editable and persisted', async () => {
    await openNotebook();
    await user.selectOptions(screen.getByRole('combobox', { name: 'TLP marking' }), 'RED');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Note status' }), 'escalated');
    await user.type(screen.getByRole('textbox', { name: 'Case or alert ID' }), 'INC-42');
    await user.type(screen.getByRole('textbox', { name: 'Add tag' }), 'kerberos{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Add tag' }), 'ad,');
    flush();
    const n = JSON.parse(localStorage.getItem(NOTES_KEY))[0];
    expect(n).toMatchObject({ tlp: 'RED', status: 'escalated', caseRef: 'INC-42', tags: ['kerberos', 'ad'] });
    await user.click(screen.getByRole('button', { name: 'Remove tag ad' }));
    expect(store.get().notes[0].tags).toEqual(['kerberos']);
  });

  test('dashboard evidence (event) lands as a formatted table with a verification reminder', async () => {
    const ed = await openNotebook();
    act(() => { window.dispatchEvent(new CustomEvent(NOTEBOOK_INSERT_EVENT, { detail: { ctx: { type: 'alert', id: 'ALT-9', user: 'j.chen', sourceIp: '203.0.113.9' } } })); });
    await waitFor(() => expect(ed.innerHTML).toContain('Captured alert: ALT-9'));
    expect(ed.querySelector('table')).toBeTruthy();
    expect(ed.textContent).toContain('j.chen');
    expect(ed.textContent).toMatch(/Verify against source events/);
  });

  test('open event shows the notebook even when it was closed', async () => {
    user = userEvent.setup();
    render(<AssistantProvider page="x"><NotebookLauncher /></AssistantProvider>);
    act(() => { window.dispatchEvent(new CustomEvent(NOTEBOOK_OPEN_EVENT)); });
    expect(await screen.findByRole('textbox', { name: 'Security investigation note' })).toBeTruthy();
  });

  test('deleting a note shows an Undo toast that restores it', async () => {
    await openNotebook();
    const id = store.get().notes[0].id;
    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(screen.getByRole('status').textContent).toMatch(/moved to Recently deleted/);
    await user.click(screen.getByRole('button', { name: 'Undo delete' }));
    expect(store.get().notes.some((n) => n.id === id)).toBe(true);
  });
});

describe('editor features', () => {
  test('slash menu filters, inserts security blocks and AI is listed', async () => {
    const ed = await openNotebook();
    act(() => { ed.editor.commands.focus('end'); ed.editor.commands.insertContent('/timel'); });
    const list = await screen.findByRole('listbox', { name: 'Insert block' });
    expect(within(list).getByRole('option', { name: /Timeline \(UTC\)/ })).toBeTruthy();
    await user.click(within(list).getByRole('option', { name: /Timeline \(UTC\)/ }));
    await waitFor(() => expect(ed.textContent).toContain('Time (UTC)'));
    expect(ed.textContent).not.toContain('/timel');
    act(() => { ed.editor.commands.insertContent('/ai'); });
    expect(within(await screen.findByRole('listbox', { name: 'Insert block' })).getAllByRole('option').some((o) => /Ask AI/.test(o.textContent))).toBe(true);
  });

  test('hypothesis callout is a distinct block that survives save and reload', async () => {
    const ed = await openNotebook();
    act(() => { ed.editor.chain().focus('end').insertContent('<div data-callout="hypothesis"><p>Maybe spraying</p></div>').run(); });
    flush();
    expect(JSON.parse(localStorage.getItem(NOTES_KEY))[0].html).toContain('data-callout="hypothesis"');
    expect([...ed.querySelectorAll('[data-callout="hypothesis"]')].some((n) => n.textContent === 'Maybe spraying')).toBe(true);
  });

  test('toolbar toggles marks, undo works, and table tools appear inside a table', async () => {
    const ed = await openNotebook();
    act(() => { ed.editor.chain().focus('end').insertContent('word').selectAll().run(); });
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(ed.innerHTML).toContain('<strong>');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(ed.innerHTML).not.toContain('<strong>');
    act(() => { ed.editor.chain().focus('end').insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run(); });
    expect(await screen.findByRole('toolbar', { name: 'Table tools' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add row below' }));
    expect(ed.querySelectorAll('tr').length).toBeGreaterThanOrEqual(3);
  });

  test('links accept only http(s)/mailto', async () => {
    const ed = await openNotebook();
    act(() => { ed.editor.chain().focus('end').insertContent('click').selectAll().run(); });
    await user.click(screen.getByRole('button', { name: 'Link' }));
    const input = screen.getByRole('textbox', { name: 'Link address' });
    await user.clear(input); await user.type(input, 'javascript:alert(1)');
    expect(screen.getByRole('button', { name: 'Apply' }).disabled).toBe(true);
    await user.clear(input); await user.type(input, 'https://attack.mitre.org');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(ed.querySelector('a').getAttribute('href')).toBe('https://attack.mitre.org');
  });
});

describe('library drawer', () => {
  test('reference: search event IDs, insert into the note, ATT&CK link points at MITRE', async () => {
    const ed = await openNotebook();
    await user.click(screen.getByRole('button', { name: 'Security reference' }));
    await user.type(screen.getByRole('textbox', { name: 'Search reference' }), '4625');
    expect(screen.getByText('Failed logon')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Insert event 4625' }));
    await waitFor(() => expect(ed.textContent).toContain('4625 Failed logon'));
    await user.click(screen.getByRole('tab', { name: 'ATT&CK' }));
    await user.type(screen.getByRole('textbox', { name: 'Search reference' }), 'spray');
    expect(screen.getByRole('link', { name: /T1110.003 on MITRE/ }).getAttribute('href')).toBe('https://attack.mitre.org/techniques/T1110/003/');
  });

  test('IOC panel finds indicators in the note, defangs on copy, and adds to the IOC table', async () => {
    await openNotebook();
    setBody('<p>Failures from 203.0.113.9 and hash d41d8cd98f00b204e9800998ecf8427e</p>');
    await user.click(screen.getByRole('button', { name: 'Indicators in this note' }));
    const list = screen.getByRole('list', { name: 'Indicators' });
    expect(within(list).getByText('203.0.113.9')).toBeTruthy();
    expect(within(list).getByText('d41d8cd98f00b204e9800998ecf8427e')).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: /Defang/ }));
    expect(within(list).getByText('203[.]0[.]113[.]9')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add 203.0.113.9 to IOC table' }));
    await waitFor(() => expect(store.get().notes[0].html).toContain('<th>Type</th>'));
  });

  test('notes list searches body text and tags, and TLP filter works', async () => {
    await openNotebook();
    notebook.updateNote(store.get().notes[0].id, { title: 'Alpha case', html: '<p>kerberoasting spike</p>', tags: ['ad'] });
    notebook.createNote('blank', { title: 'Beta', html: '<p>unrelated</p>', tlp: 'GREEN' });
    await user.click(screen.getByRole('button', { name: 'Browse notes' }));
    const list = () => screen.getByRole('list', { name: 'Notes' });
    expect(within(list()).getAllByRole('listitem')).toHaveLength(2);
    await user.type(screen.getByRole('textbox', { name: 'Search notes' }), 'kerberoasting');
    expect(within(list()).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list()).getByText('Alpha case')).toBeTruthy();
    await user.clear(screen.getByRole('textbox', { name: 'Search notes' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by TLP' }), 'GREEN');
    expect(within(list()).getByText('Beta')).toBeTruthy();
    expect(within(list()).queryByText('Alpha case')).toBeNull();
  });

  test('settings: font size and width apply, defang setting persists, backup export/import round trip', async () => {
    await openNotebook();
    await user.click(screen.getByRole('button', { name: 'Notebook settings' }));
    await user.click(screen.getByRole('radio', { name: 'L' }));
    expect(screen.getByRole('region', { name: 'Security Notebook' }).dataset.font).toBe('large');
    await user.click(screen.getByRole('switch', { name: 'Defang indicators in exports' }));
    flush();
    expect(JSON.parse(localStorage.getItem('cyberdna-notebook-settings-v1'))).toMatchObject({ fontSize: 'large', defangExports: true });
    const backup = notebook.exportBackup();
    const input = screen.getByLabelText('Import notebook backup file');
    const file = new File([backup], 'b.json', { type: 'application/json' });
    file.text = async () => backup;
    await user.upload(input, file);
    expect(await screen.findByText(/Imported 1 note/)).toBeTruthy();
  });
});

describe('sharing and export', () => {
  test('TLP:RED blocks copy and share; restricted levels need confirmation before download', async () => {
    await openNotebook();
    await user.selectOptions(screen.getByRole('combobox', { name: 'TLP marking' }), 'RED');
    await user.click(screen.getByRole('button', { name: /^Share$/ }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByRole('button', { name: 'Copy text' }).disabled).toBe(true);
    expect(within(dlg).getByRole('button', { name: /Download/ }).disabled).toBe(true);
    await user.click(within(dlg).getByRole('checkbox', { name: /every recipient is permitted/ }));
    expect(within(dlg).getByRole('button', { name: /Download/ }).disabled).toBe(false);
    expect(within(dlg).getByRole('button', { name: 'Copy text' }).disabled).toBe(true);
  });

  test('AMBER copy includes the TLP banner and defanged indicators', async () => {
    await openNotebook();
    setBody('<p>from 203.0.113.9</p>');
    const written = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { written.push(t); } }, configurable: true });
    await user.click(screen.getByRole('button', { name: /^Share$/ }));
    const dlg = screen.getByRole('dialog');
    await user.click(within(dlg).getByRole('checkbox', { name: /Defang/ }));
    await user.click(within(dlg).getByRole('checkbox', { name: /every recipient/ }));
    await user.click(within(dlg).getByRole('button', { name: 'Copy text' }));
    await waitFor(() => expect(written[0]).toBeTruthy());
    expect(written[0]).toMatch(/^TLP:AMBER/);
    expect(written[0]).toContain('203[.]0[.]113[.]9');
  });
});

describe('AI in the notebook', () => {
  async function selectText(ed, text) {
    act(() => { ed.editor.chain().focus('end').insertContent(`<p>${text}</p>`).run(); });
    const { doc } = ed.editor.state; let from = 0;
    doc.descendants((n, pos) => { if (n.isText && n.text === text) from = pos; });
    act(() => { ed.editor.commands.setTextSelection({ from, to: from + text.length }); });
  }
  const runAi = async (label) => { await user.click(screen.getByRole('button', { name: 'AI actions' })); await user.click(await screen.findByRole('menuitem', { name: label })); };

  test('Improve writing sends only the selection, shows a reviewable draft, and Replace applies it with a snapshot', async () => {
    const ed = await openNotebook();
    setBody('<p>CONFIDENTIAL background paragraph that must not be sent.</p>');
    await selectText(ed, 'teh user logged on twice');
    global.fetch.mockResolvedValueOnce(json({ reply: 'The user logged on twice.' }));
    await runAi('Improve writing');
    const card = await screen.findByRole('region', { name: 'AI result' });
    expect(within(card).getByText('The user logged on twice.')).toBeTruthy();
    expect(within(card).getByText(/AI draft: review before use/)).toBeTruthy();
    const body = bodies()[0];
    expect(body.context.excerpt.text).toBe('teh user logged on twice');
    expect(body.context.note).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('CONFIDENTIAL');
    expect(body.message).toMatch(/Never invent event IDs/);
    expect(ed.textContent).toContain('teh user logged on twice'); // nothing applied yet
    await user.click(within(card).getByRole('button', { name: 'Replace selection' }));
    expect(ed.textContent).toContain('The user logged on twice.');
    expect(ed.textContent).not.toContain('teh user');
    expect(store.get().notes[0].versions[0].label).toBe('Before AI replace');
  });

  test('note-level task sends a note excerpt, Insert below wraps it in a labelled AI block', async () => {
    const ed = await openNotebook();
    setBody('<p>Logon failures at 2026-10-01T10:00:00Z from 203.0.113.9</p>');
    global.fetch.mockResolvedValueOnce(json({ reply: '- 2026-10-01T10:00:00Z: failures observed' }));
    await runAi('Build UTC timeline from note');
    const card = await screen.findByRole('region', { name: 'AI result' });
    expect(bodies()[0].context.note.text).toContain('203.0.113.9');
    await user.click(within(card).getByRole('button', { name: 'Insert below' }));
    await waitFor(() => expect(ed.querySelector('[data-callout="ai"]')).toBeTruthy());
    expect(ed.querySelector('[data-callout="ai"]').textContent).toMatch(/AI draft, verify before use/);
    expect(screen.queryByRole('region', { name: 'AI result' })).toBeNull();
  });

  test('TLP:RED notes are never sent to the AI; the analyst is told why', async () => {
    await openNotebook();
    await user.selectOptions(screen.getByRole('combobox', { name: 'TLP marking' }), 'RED');
    setBody('<p>secret</p>');
    await runAi('Draft executive summary');
    expect((await screen.findByRole('alert')).textContent).toMatch(/TLP:RED notes are never sent/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('backend errors surface with retry; Discard ignores a late answer', async () => {
    await openNotebook();
    setBody('<p>some note text</p>');
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404, headers: { get: () => 'application/json' }, json: async () => ({}) });
    await runAi('Suggest next steps');
    expect((await screen.findByRole('alert')).textContent).toMatch(/not available on this backend/);
    let release; global.fetch.mockReturnValueOnce(new Promise((r) => { release = r; }));
    await user.click(screen.getByRole('button', { name: /Retry/ }));
    await user.click(await screen.findByRole('button', { name: 'Discard AI result' }));
    release(json({ reply: 'late' }));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('late')).toBeNull();
  });

  test('Ask AI… takes a free-form question and respects masking settings', async () => {
    const ed = await openNotebook();
    setAiSettings({ redact: true });
    await selectText(ed, 'j.chen from 203.0.113.9');
    global.fetch.mockResolvedValueOnce(json({ reply: 'Looks like IP-1 for USER-1' }));
    await runAi('Ask AI…');
    await user.type(await screen.findByRole('textbox', { name: 'Ask AI' }), 'who is this?{Enter}');
    const card = await screen.findByRole('region', { name: 'AI result' });
    const body = bodies()[0];
    expect(body.context.excerpt.text).toContain('IP-1');
    expect(JSON.stringify(body)).not.toContain('203.0.113.9');
    expect(body.options.redacted).toBe(true);
    expect(within(card).getByText(/Looks like/)).toBeTruthy();
  });
});

describe('window placement (regression: saved position from a larger screen)', () => {
  test('a saved off-screen position is pulled back inside a small viewport and phones get a full-width sheet', async () => {
    localStorage.setItem('cyberdna-notebook-window', JSON.stringify({ left: 900, top: 700, width: 620, height: 700 }));
    const w = window.innerWidth; const h = window.innerHeight;
    window.innerWidth = 390; window.innerHeight = 844;
    try {
      await openNotebook();
      const win = screen.getByRole('region', { name: 'Security Notebook' });
      expect(parseInt(win.style.left, 10)).toBe(8);
      expect(parseInt(win.style.width, 10)).toBe(374);
      expect(parseInt(win.style.top, 10) + parseInt(win.style.height, 10)).toBeLessThanOrEqual(844 - 8);
      expect(JSON.parse(localStorage.getItem('cyberdna-notebook-window')).left).toBe(900); // the desktop position is not overwritten
    } finally { window.innerWidth = w; window.innerHeight = h; }
  });
  test('on a desktop viewport a stale off-screen position is clamped', async () => {
    localStorage.setItem('cyberdna-notebook-window', JSON.stringify({ left: 5000, top: 5000, width: 620, height: 700 }));
    await openNotebook();
    const win = screen.getByRole('region', { name: 'Security Notebook' });
    expect(parseInt(win.style.left, 10) + parseInt(win.style.width, 10)).toBeLessThanOrEqual(window.innerWidth - 8);
    expect(parseInt(win.style.top, 10) + parseInt(win.style.height, 10)).toBeLessThanOrEqual(window.innerHeight - 8);
  });
});
