// Advanced AI Analyst behavior. fetch is stubbed with the PROPOSED /assistant/chat contract; this proves frontend behavior only.
import React from 'react';
import { render, screen, cleanup, waitFor, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantProvider, useAssistantContext, prepareRequest } from '../src/components/assistant/AssistantProvider';
import AssistantPanel from '../src/components/assistant/AssistantPanel';
import { alertContext } from '../src/components/assistant/contextBuilders';
import { createRedactor } from '../src/components/assistant/redact';
import { setAiSettings, resetAiSettings, AI_DEFAULTS } from '../src/components/assistant/assistantSettings';
import { notebook, store } from '../src/notebook/notebookStore';

const ALERT = { id: 'ALT-901', title: 'Privilege Escalation', severity: 'critical', status: 'New', rule: 'Domain Admin add', eventId: '4728', user: 'j.chen', host: 'DC01', ip: '203.0.113.9', ts: '2026-09-27T14:07:55Z', score: 92 };
const json = (b) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => b });
const bodies = () => global.fetch.mock.calls.map(([, o]) => JSON.parse(o.body));
function Page() { useAssistantContext({ selection: alertContext(ALERT) }); return null; }
let user;
async function setup() {
  user = userEvent.setup();
  render(<AssistantProvider page="Alerts" query=""><Page /><AssistantPanel /></AssistantProvider>);
  await user.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
}
const ask = async (t) => { await user.type(screen.getByLabelText('Message to AI Analyst'), `${t}{Enter}`); };

beforeEach(() => { localStorage.clear(); notebook.reload(); resetAiSettings(); global.fetch = vi.fn(); sessionStorage.setItem('cyberdna-token', 't'); });
afterEach(cleanup);

describe('redaction', () => {
  test('masks IPs, users and hosts consistently (case-insensitive, whole tokens only) and restores them', () => {
    const payload = { message: 'Why did J.Chen reach 203.0.113.9 from dc01? also a.smith2 and 10.1.1.1', history: [{ role: 'user', content: 'j.chen again' }], context: { page: 'Alerts', selection: { user: 'j.chen', host: 'DC01', sourceIp: '203.0.113.9' } } };
    const r = createRedactor(payload);
    const s = JSON.stringify(r.redacted);
    expect(s).not.toMatch(/j\.chen|203\.0\.113\.9|DC01|dc01/i);
    expect(r.redacted.message).toContain('USER-1'); expect(r.redacted.message).toContain('IP-1'); expect(r.redacted.message).toContain('HOST-1');
    expect(r.redacted.message).toContain('a.smith2'); // not an identifier we know, left alone
    expect(r.redacted.history[0].content).toBe('USER-1 again'); // same token everywhere
    expect(r.restore('IP-1 used USER-1 on HOST-1; IP-9 unknown')).toBe('203.0.113.9 used j.chen on DC01; IP-9 unknown');
    expect(r.count).toBeGreaterThanOrEqual(4);
  });
  test('prepareRequest honors history length and only masks when enabled', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `m${i} 203.0.113.9` }));
    const off = prepareRequest({ message: 'q', history, context: { page: 'x' }, settings: { ...AI_DEFAULTS, historyTurns: 6 } });
    expect(off.payload.history).toHaveLength(6); expect(JSON.stringify(off.payload)).toContain('203.0.113.9');
    const none = prepareRequest({ message: 'q', history, context: {}, settings: { ...AI_DEFAULTS, historyTurns: 0 } });
    expect(none.payload.history).toEqual([]); expect(none.payload.context).toBeUndefined();
    const on = prepareRequest({ message: 'q', history, context: {}, settings: { ...AI_DEFAULTS, redact: true } });
    expect(JSON.stringify(on.payload)).not.toContain('203.0.113.9'); expect(on.redactions).toBe(1);
  });
});

describe('settings', () => {
  test('response style and audience are sent as options and persisted; masking applies end to end with restored answer', async () => {
    await setup();
    await user.click(screen.getByRole('button', { name: 'AI Analyst settings' }));
    const dlg = screen.getByRole('dialog', { name: 'AI Analyst settings' });
    await user.click(within(dlg).getByRole('radio', { name: 'Detailed' }));
    await user.click(within(dlg).getByRole('radio', { name: 'Executive' }));
    await user.click(within(dlg).getByRole('switch', { name: 'Mask IPs, users and hosts' }));
    expect(JSON.parse(localStorage.getItem('cyberdna-ai-settings-v1'))).toMatchObject({ responseStyle: 'detailed', audience: 'executive', redact: true });
    await user.click(within(dlg).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: /Masking on/ })).toBeTruthy();
    global.fetch.mockResolvedValueOnce(json({ reply: 'USER-1 added to a group from IP-1 on HOST-1' }));
    await ask('What did j.chen do?');
    // placeholders in the answer are restored locally, and the real values become copyable chips
    expect(await screen.findByRole('button', { name: 'Copy j.chen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy 203.0.113.9' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy DC01' })).toBeTruthy();
    expect(document.querySelector('.as-ai .as-rich').textContent).toBe('j.chen added to a group from 203.0.113.9 on DC01');
    const b = bodies()[0];
    expect(b.options).toEqual({ responseStyle: 'detailed', audience: 'executive', redacted: true });
    expect(JSON.stringify(b)).not.toMatch(/j\.chen|203\.0\.113\.9|DC01/);
    expect(b.context.selection.user).toBe('USER-1');
    await user.click(screen.getByText(/What was sent/));
    expect(document.querySelector('.as-sent pre').textContent).not.toMatch(/j\.chen|203\.0\.113\.9/);
  });

  test('Ctrl+Enter send mode, and earlier-message count can be turned off', async () => {
    await setup();
    setAiSettings({ sendKey: 'mod-enter', historyTurns: 0 });
    const box = screen.getByLabelText('Message to AI Analyst');
    global.fetch.mockResolvedValue(json({ reply: 'ok' }));
    await user.type(box, 'first{Enter}');
    expect(global.fetch).not.toHaveBeenCalled(); expect(box.value).toBe('first\n');
    await user.type(box, '{Control>}{Enter}{/Control}');
    await screen.findByText('ok');
    await user.type(box, 'second');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(bodies()[1].history).toEqual([]);
  });

  test('selection toolbar can be switched off from the settings', async () => {
    await setup();
    await user.click(screen.getByRole('button', { name: 'AI Analyst settings' }));
    await user.click(screen.getByRole('switch', { name: 'Selection actions' }));
    expect(JSON.parse(localStorage.getItem('cyberdna-ai-settings-v1')).selectionToolbar).toBe(false);
  });
});

describe('conversation tools', () => {
  test('typing / opens saved prompts; Enter picks one without sending; Esc clears', async () => {
    await setup();
    const box = screen.getByLabelText('Message to AI Analyst');
    await user.type(box, '/tim');
    const list = screen.getByRole('listbox', { name: 'Saved prompts' });
    expect(within(list).getByRole('option', { name: /Build a UTC timeline/ })).toBeTruthy();
    await user.keyboard('{Enter}');
    expect(box.value).toMatch(/Build a timeline of the events using only timestamps/);
    expect(global.fetch).not.toHaveBeenCalled();
    await user.clear(box); await user.type(box, '/'); await user.keyboard('{Escape}');
    expect(box.value).toBe('');
    expect(screen.getByRole('complementary', { name: 'AI Analyst' }).hidden).toBe(false); // Esc closed the menu, not the panel
  });

  test('Cancel stops a pending request, ignores its late answer, and the question can be retried', async () => {
    await setup();
    let release; global.fetch.mockReturnValueOnce(new Promise((r) => { release = r; }));
    await ask('slow question');
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Request cancelled/);
    release(json({ reply: 'too late' }));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('too late')).toBeNull();
    global.fetch.mockResolvedValueOnce(json({ reply: 'retried answer' }));
    await user.click(screen.getByRole('button', { name: /Retry/ }));
    await screen.findByText('retried answer');
    expect(screen.getAllByText('slow question')).toHaveLength(1);
  });

  test('Regenerate replaces the last answer and resends without the old answer in history', async () => {
    await setup();
    global.fetch.mockResolvedValueOnce(json({ reply: 'answer one' })).mockResolvedValueOnce(json({ reply: 'answer two' }));
    await ask('explain');
    await screen.findByText('answer one');
    await user.click(screen.getByRole('button', { name: 'Regenerate answer' }));
    await screen.findByText('answer two');
    expect(screen.queryByText('answer one')).toBeNull();
    expect(bodies()[1].message).toBe('explain');
    expect(bodies()[1].history).toEqual([]);
  });

  test('Save to Notebook stores the answer as a labelled AI draft with the question', async () => {
    await setup();
    global.fetch.mockResolvedValueOnce(json({ reply: 'Line one\n- point a' }));
    await ask('Why flagged?');
    await screen.findByText('Line one');
    await user.click(screen.getByRole('button', { name: 'Save to Notebook' }));
    const html = store.get().notes.find((n) => n.id === store.get().activeId).html;
    expect(html).toContain('data-callout="ai"');
    expect(html).toContain('Question: Why flagged?');
    expect(html).toContain('<li><p>point a</p></li>');
    expect(store.get().open).toBe(true);
  });

  test('open note can be attached; TLP:RED notes are blocked and never sent', async () => {
    await setup();
    notebook.setHtml('<p>Findings about 203.0.113.9</p>');
    global.fetch.mockResolvedValue(json({ reply: 'ok' }));
    await user.click(screen.getByRole('button', { name: /Attach open note/ }));
    await ask('summarise the note');
    await screen.findByText('ok');
    expect(bodies()[0].context.note).toMatchObject({ tlp: 'AMBER', text: expect.stringContaining('203.0.113.9') });
    act(() => { notebook.updateNote(store.get().activeId, { tlp: 'RED' }); });
    const chip = await screen.findByRole('button', { name: /Note blocked: TLP:RED/ });
    expect(chip).toBeTruthy();
    await ask('again');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(bodies()[1].context.note).toBeUndefined();
  });

  test('window can be docked and reset from settings, and gets focus order on click', async () => {
    await setup();
    const win = screen.getByRole('complementary', { name: 'AI Analyst' });
    await user.click(screen.getByRole('button', { name: 'AI Analyst settings' }));
    await user.click(screen.getByRole('button', { name: /Dock left/ }));
    expect(parseInt(win.style.left, 10)).toBe(8);
    fireEvent.pointerDown(win);
    expect(win.style.zIndex).toBe('56');
  });
});
