// Click-flexibility layer exercised through the real App shell and pages. fetch is stubbed (alerts/users) and the proposed /assistant/chat.
import React from 'react';
import { render, screen, cleanup, waitFor, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { notebook, store } from '../src/notebook/notebookStore';
import { resetAiSettings } from '../src/components/assistant/assistantSettings';

const json = (b) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => b });
const ALERTS = [{ id: 'ALT-1', severity: 'high', rule: 'Brute force', score: 71, user: 'a.smith', host: 'WS07', ip: '203.0.113.5', time: '2026-10-01T10:00:00Z', detail: 'Many failed logons from 203.0.113.5', event_id: '4625', explanation: 'x' }];
const USERS = [{ username: 'a.smith', department: 'Finance', risk_score: 64, what_happened: 'W', what_it_means: 'M', recommendation: 'R' }];
const chatBodies = () => global.fetch.mock.calls.filter(([u]) => String(u).includes('/assistant/chat')).map(([, o]) => JSON.parse(o.body));
let user;
async function boot() {
  user = userEvent.setup();
  render(<App />);
  return screen.findByRole('button', { name: 'Brute force' });
}
const alertCard = (el) => el.closest('article, tr, li, .alert-card') || el;

beforeEach(() => {
  localStorage.clear(); notebook.reload(); resetAiSettings();
  sessionStorage.setItem('cyberdna-splash', '1'); sessionStorage.setItem('cyberdna-session', '1');
  window.location.hash = '#/alerts';
  global.fetch = vi.fn(async (url) => {
    if (String(url).endsWith('/auth/me')) {
      return json({
        id: 1,
        username: 'test-admin',
        email: 'test@example.com',
        role: 'platform_admin',
        organization_id: 1,
        must_change_password: false
      });
    }
    if (String(url).endsWith('/onboarding')) {
      return json({ completed: true });
    }
    if (String(url).includes('/assistant/chat')) return json({ reply: 'fine' });
    if (String(url).endsWith('/alerts')) return json(ALERTS);
    if (String(url).endsWith('/users')) return json(USERS);
    return { ok: false, status: 404, headers: { get: () => 'application/json' }, json: async () => ({}) };
  });
});
afterEach(cleanup);

describe('global shortcuts', () => {
  test('Alt+A toggles the AI Analyst and Alt+N toggles the Notebook, even while typing', async () => {
    await boot();
    fireEvent.keyDown(document.body, { code: 'KeyA', key: 'a', altKey: true });
    expect(screen.getByRole('complementary', { name: 'AI Analyst' }).hidden).toBe(false);
    fireEvent.keyDown(screen.getByLabelText('Message to AI Analyst'), { code: 'KeyA', key: 'å', altKey: true });
    expect(document.getElementById('ai-analyst-panel').hidden).toBe(true);
    fireEvent.keyDown(document.body, { code: 'KeyN', key: 'n', altKey: true });
    expect(await screen.findByRole('textbox', { name: 'Security investigation note' }, { timeout: 5000 })).toBeTruthy(); // lazy chunk
    fireEvent.keyDown(document.body, { code: 'KeyN', key: 'n', altKey: true });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Security investigation note' })).toBeNull());
  });

  test('help dialog documents the new shortcuts', async () => {
    await boot();
    fireEvent.keyDown(document.body, { key: '/', ctrlKey: true });
    const dlg = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    ['Alt A', 'Alt N', 'Menu key / Shift F10', 'Long-press', 'Alt + arrows'].forEach((k) => expect(within(dlg).getByText(k)).toBeTruthy());
  });
});

describe('context menu', () => {
  test('shows accelerators, flips to stay on screen, and single-key accelerators run actions', async () => {
    const btn = await boot();
    window.innerWidth = 400; window.innerHeight = 300;
    fireEvent.contextMenu(btn, { clientX: 390, clientY: 290 });
    const menu = await screen.findByRole('menu', { name: 'alert actions' });
    const items = within(menu).getAllByRole('menuitem').map((i) => i.textContent);
    expect(items.join('|')).toMatch(/Explain with AI.*E/); expect(items.join('|')).toMatch(/Add evidence to Notebook.*N/); expect(items.join('|')).toMatch(/Add IP to IOC table.*I/);
    expect(parseInt(menu.style.left, 10)).toBeLessThanOrEqual(400); expect(parseInt(menu.style.top, 10)).toBeGreaterThanOrEqual(8);
    fireEvent.keyDown(menu, { key: 'n' });
    await waitFor(() => expect(store.get().notes.find((n) => n.id === store.get().activeId).html).toContain('Captured alert: ALT-1'));
    expect(screen.queryByRole('menu', { name: 'alert actions' })).toBeNull();
    expect(store.get().open).toBe(true);
    window.innerWidth = 1024; window.innerHeight = 768;
  });

  test('Explain with AI opens the analyst with the item as context and sends the prompt automatically', async () => {
    const btn = await boot();
    fireEvent.contextMenu(btn, { clientX: 100, clientY: 100 });
    await user.click(await screen.findByRole('menuitem', { name: /Explain with AI/ }));
    await screen.findByText('fine');
    const b = chatBodies()[0];
    expect(b.message).toBe('Explain this alert in simple terms');
    expect(b.context.selection).toMatchObject({ type: 'alert', id: 'ALT-1', eventId: '4625', user: 'a.smith' });
  });

  test('Add IP to IOC table puts a row in the note; copy summary writes JSON', async () => {
    const btn = await boot();
    const written = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { written.push(t); } }, configurable: true });
    fireEvent.contextMenu(btn, { clientX: 100, clientY: 100 });
    await user.click(await screen.findByRole('menuitem', { name: /Add IP to IOC table/ }));
    const html = store.get().notes.find((n) => n.id === store.get().activeId).html;
    expect(html).toContain('203.0.113.5'); expect(html).toContain('<th>Type</th>');
    fireEvent.contextMenu(btn, { clientX: 100, clientY: 100 });
    await user.click(await screen.findByRole('menuitem', { name: /Copy summary as JSON/ }));
    await waitFor(() => expect(written.length).toBe(1));
    expect(JSON.parse(written[0])).toMatchObject({ type: 'alert', id: 'ALT-1' });
  });

  test('keyboard: Shift+F10 on a focused control inside a row opens the same menu; Esc closes it', async () => {
    const btn = await boot();
    btn.focus();
    fireEvent.keyDown(btn, { key: 'F10', shiftKey: true });
    expect(await screen.findByRole('menu', { name: 'alert actions' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'alert actions' })).toBeNull());
  });

  test('touch: a long-press opens the menu, a short tap does not', async () => {
    const btn = await boot();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const touch = (type, extra = {}) => { const e = new MouseEvent(type, { bubbles: true, clientX: 50, clientY: 50, ...extra }); Object.defineProperties(e, { pointerType: { value: 'touch' }, isPrimary: { value: true } }); return e; };
    act(() => { btn.dispatchEvent(touch('pointerdown')); });
    act(() => { vi.advanceTimersByTime(200); btn.dispatchEvent(touch('pointerup')); vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('menu', { name: 'alert actions' })).toBeNull();
    act(() => { btn.dispatchEvent(touch('pointerdown')); });
    act(() => { vi.advanceTimersByTime(600); });
    expect(await screen.findByRole('menu', { name: 'alert actions' })).toBeTruthy();
    vi.useRealTimers();
  });

  test('a native contextmenu arriving right after a long-press does not reopen or duplicate the menu', async () => {
    const btn = await boot();
    fireEvent.contextMenu(btn, { clientX: 60, clientY: 60 });
    await screen.findByRole('menu', { name: 'alert actions' });
    fireEvent.contextMenu(btn, { clientX: 62, clientY: 61 });
    expect(screen.getAllByRole('menu', { name: 'alert actions' })).toHaveLength(1);
  });
});

describe('command palette', () => {
  const openPalette = async () => { fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true }); return screen.findByRole('dialog', { name: 'Command palette' }); };

  test('groups results and shows shortcut hints', async () => {
    await boot();
    const dlg = await openPalette();
    const groups = [...dlg.querySelectorAll('.ws-group')].map((g) => g.textContent);
    expect(groups).toEqual(expect.arrayContaining(['Actions', 'Navigate', 'Notes', 'Records']));
    expect(within(dlg).getByText('Alt A')).toBeTruthy();
    expect(within(dlg).getByText('Alt N')).toBeTruthy();
  });

  test('typing a question offers Ask AI first and Enter sends it with page context', async () => {
    await boot();
    await openPalette();
    await user.type(screen.getByRole('textbox', { name: /Search commands/ }), 'why is a.smith risky');
    expect(within(screen.getByRole('listbox', { name: 'Commands and records' })).getAllByRole('option')[0].textContent).toMatch(/Ask AI: “why is a\.smith risky”/);
    await user.keyboard('{Enter}');
    await screen.findByText('fine');
    expect(chatBodies()[0]).toMatchObject({ message: 'why is a.smith risky', context: { page: 'Alerts' } });
  });

  test('finds notes by title and opens them; creates notes from templates', async () => {
    await boot();
    notebook.createNote('blank', { title: 'Kerberoasting case' });
    notebook.createNote('blank', { title: 'Other' });
    notebook.setActive(store.get().notes[store.get().notes.length - 1].id);
    await openPalette();
    await user.type(screen.getByRole('textbox', { name: /Search commands/ }), 'kerberoast');
    await user.click(screen.getByRole('option', { name: /Kerberoasting case/ }));
    expect(store.get().notes.find((n) => n.id === store.get().activeId).title).toBe('Kerberoasting case');
    expect(store.get().open).toBe(true);
    await openPalette();
    await user.type(screen.getByRole('textbox', { name: /Search commands/ }), 'New note: Alert triage');
    await user.click(screen.getByRole('option', { name: /^New note: Alert triage/ }));
    expect(store.get().notes[0].title).toBe('Alert triage');
  });

  test('palette can act on text that was selected before it opened (keyboard route to selection actions)', async () => {
    await boot();
    const target = screen.getByRole('button', { name: 'Brute force' });
    const range = document.createRange(); range.selectNodeContents(target);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    await openPalette();
    await user.click(screen.getByRole('option', { name: /Add selected text to Notebook/ }));
    expect(store.get().notes.find((n) => n.id === store.get().activeId).html).toContain('Brute force');
  });
});

describe('selection toolbar', () => {
  const selectText = async (el, whole = true) => {
    const range = document.createRange(); range.selectNodeContents(el);
    range.getBoundingClientRect = () => ({ left: 100, right: 200, top: 120, bottom: 140, width: 100, height: 20 });
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    act(() => { document.dispatchEvent(new Event('selectionchange')); });
    await new Promise((r) => setTimeout(r, 160)); // the toolbar debounces selection changes
    return screen.findByRole('toolbar', { name: 'Selection actions' }, { timeout: 1500 });
  };

  test('selecting page text offers Ask AI, which attaches the excerpt as removable context', async () => {
    await boot();
    const bar = await selectText(screen.getByRole('button', { name: 'Brute force' }));
    await user.click(within(bar).getByRole('button', { name: /Ask AI/ }));
    expect(screen.getByRole('complementary', { name: 'AI Analyst' }).hidden).toBe(false);
    expect(screen.getByRole('button', { name: 'Remove selected text' })).toBeTruthy();
    await user.type(screen.getByLabelText('Message to AI Analyst'), 'what does this mean?{Enter}');
    await screen.findByText('fine');
    expect(chatBodies()[0].context.excerpt).toMatchObject({ text: 'Brute force', from: 'Selected on Alerts' });
    expect(screen.queryByRole('button', { name: 'Remove selected text' })).toBeNull(); // one-shot
  });

  test('Add to Notebook appends the quote with its source; a single IP also offers Add as IOC', async () => {
    await boot();
    const ipEl = document.createElement('span'); ipEl.textContent = '203.0.113.5'; document.querySelector('main, .main, body').appendChild(ipEl);
    let bar = await selectText(ipEl);
    await user.click(within(bar).getByRole('button', { name: /Add as IOC/ }));
    const html = () => store.get().notes.find((n) => n.id === store.get().activeId).html;
    expect(html()).toContain('<th>Value</th>'); expect(html()).toContain('203.0.113.5');
    const text = screen.getByRole('button', { name: 'Brute force' });
    bar = await selectText(text);
    expect(within(bar).queryByRole('button', { name: /Add as IOC/ })).toBeNull(); // a sentence is not a single indicator
    await user.click(within(bar).getByRole('button', { name: /Add to Notebook/ }));
    expect(html()).toContain('Brute force'); expect(html()).toMatch(/Captured .* from Alerts page/);
  });

  test('does not appear for text inside inputs, and stays off when disabled in settings', async () => {
    await boot();
    const input = document.createElement('input'); input.value = 'typed text here'; document.body.appendChild(input); input.select();
    act(() => { document.dispatchEvent(new Event('selectionchange')); });
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole('toolbar', { name: 'Selection actions' })).toBeNull();
    const { setAiSettings } = await import('../src/components/assistant/assistantSettings');
    act(() => setAiSettings({ selectionToolbar: false }));
    const bar = document.createRange(); bar.selectNodeContents(screen.getByRole('button', { name: 'Brute force' }));
    window.getSelection().removeAllRanges(); window.getSelection().addRange(bar);
    act(() => { document.dispatchEvent(new Event('selectionchange')); });
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole('toolbar', { name: 'Selection actions' })).toBeNull();
  });
});

describe('existing dashboard navigation is unchanged', () => {
  test('sidebar navigation still switches pages with the panels open', async () => {
    await boot();
    fireEvent.keyDown(document.body, { code: 'KeyA', key: 'a', altKey: true });
    await user.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'User Behavior' }));
    expect(await screen.findByText('Monitored users')).toBeTruthy();
  });
});
