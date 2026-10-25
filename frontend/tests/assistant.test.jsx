// These tests stub fetch with the PROPOSED /assistant/chat contract (see src/api/assistant.js).
// They verify frontend behavior only; they do not prove that a real backend implements the contract.
import React, { useState } from 'react';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantProvider, useAssistantContext } from '../src/components/assistant/AssistantProvider';
import AssistantPanel from '../src/components/assistant/AssistantPanel';
import { alertContext } from '../src/components/assistant/contextBuilders';

const ALERT = { id: 'ALT-901', title: 'Privilege Escalation', severity: 'critical', status: 'New', rule: 'Domain Admin add', eventId: '4728', user: 'j.chen', host: 'DC01', ip: '192.168.1.10', ts: '2026-09-27T14:07:55Z', score: 92, description: 'Added to Domain Admins', explanation: 'x' };

function Page({ withAlert = true }) {
  useAssistantContext(withAlert ? { selection: alertContext(ALERT), filters: { severity: 'critical' } } : null);
  return <div>page</div>;
}
const ok = (body) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body });
const bad = (status) => ({ ok: false, status, headers: { get: () => 'application/json' }, json: async () => ({}) });

function setup(props = {}) {
  render(<AssistantProvider page="Alerts" query="chen"><Page {...props} /><AssistantPanel /></AssistantProvider>);
  return userEvent.setup();
}
const bodies = () => global.fetch.mock.calls.map(([, o]) => JSON.parse(o.body));

beforeEach(() => { global.fetch = vi.fn(); sessionStorage.setItem('cyberdna-token', 'tok'); });
afterEach(cleanup);

test('open, expand, close, reopen without losing the conversation', async () => {
  const u = setup();
  expect(screen.queryByRole('complementary', { name: 'AI Analyst' })).toBeNull();
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  expect(screen.getByRole('complementary', { name: 'AI Analyst' })).toBeTruthy();
  await u.click(screen.getByRole('button', { name: 'Expand panel' }));
  expect(screen.getByRole('button', { name: 'Compact panel' })).toBeTruthy();
  global.fetch.mockResolvedValueOnce(ok({ reply: 'Hello analyst' }));
  await u.type(screen.getByLabelText('Message to AI Analyst'), 'hi{Enter}');
  await screen.findByText('Hello analyst');
  await u.keyboard('{Escape}');
  expect(screen.queryByRole('complementary', { name: 'AI Analyst' })).toBeNull();
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  expect(screen.getByText('Hello analyst')).toBeTruthy();
});

test('sends authenticated request with context and shows the real reply; follow-up carries history', async () => {
  const u = setup();
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  global.fetch.mockResolvedValueOnce(ok({ reply: 'First answer about `4728`' })).mockResolvedValueOnce(ok({ reply: 'Second answer' }));
  await u.type(screen.getByLabelText('Message to AI Analyst'), 'Explain this alert{Enter}');
  await screen.findByText(/First answer/);
  await u.type(screen.getByLabelText('Message to AI Analyst'), 'and the host?{Enter}');
  await screen.findByText('Second answer');
  const [url, opts] = global.fetch.mock.calls[0];
  expect(url).toBe('/api/v1/assistant/chat');
  expect(opts.method).toBe('POST');
  expect(opts.headers.Authorization).toBe('Bearer tok');
  const [first, second] = bodies();
  expect(first.message).toBe('Explain this alert');
  expect(first.history).toEqual([]);
  expect(first.context).toMatchObject({ page: 'Alerts', search: 'chen', filters: { severity: 'critical' }, selection: { type: 'alert', id: 'ALT-901', eventId: '4728', user: 'j.chen', sourceIp: '192.168.1.10' } });
  expect(second.history).toEqual([{ role: 'user', content: 'Explain this alert' }, { role: 'assistant', content: 'First answer about `4728`' }]);
});

test('context can be removed and is then not sent; absent selection is never invented', async () => {
  const u = setup({ withAlert: false });
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  global.fetch.mockResolvedValue(ok({ reply: 'a' }));
  await u.type(screen.getByLabelText('Message to AI Analyst'), 'q1{Enter}');
  await screen.findByText('a');
  expect(bodies()[0].context.selection).toBeUndefined();
  await u.click(screen.getByRole('button', { name: 'Remove page context' }));
  await u.type(screen.getByLabelText('Message to AI Analyst'), 'q2{Enter}');
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(bodies()[1].context).toBeUndefined();
});

test('empty state shows contextual suggestions; clicking one sends it', async () => {
  const u = setup();
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  global.fetch.mockResolvedValueOnce(ok({ reply: 'done' }));
  await u.click(screen.getByRole('button', { name: 'Explain this alert in simple terms' }));
  await screen.findByText('done');
  expect(bodies()[0].message).toBe('Explain this alert in simple terms');
});

test('loading blocks duplicate submits; Shift+Enter inserts a newline', async () => {
  const u = setup();
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  let release; global.fetch.mockReturnValueOnce(new Promise((r) => { release = r; }));
  const box = screen.getByLabelText('Message to AI Analyst');
  await u.type(box, 'line1{Shift>}{Enter}{/Shift}line2');
  expect(box.value).toBe('line1\nline2');
  await u.keyboard('{Enter}');
  expect(screen.getByRole('status').textContent).toMatch(/Analyzing/);
  expect(screen.getByRole('button', { name: 'Send message' }).disabled).toBe(true);
  await u.type(box, 'again{Enter}');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  release(ok({ reply: 'finished' }));
  await screen.findByText('finished');
});

test.each([[404, /not available on this backend/], [401, /not authorized/], [403, /permission/], [500, /error \(500\)/]])('HTTP %i shows a clear error and retry succeeds without duplicating the message', async (status, re) => {
  const u = setup();
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  global.fetch.mockResolvedValueOnce(bad(status)).mockResolvedValueOnce(ok({ reply: 'recovered' }));
  await u.type(screen.getByLabelText('Message to AI Analyst'), 'question{Enter}');
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toMatch(re);
  await u.click(within(alert).getByRole('button', { name: /Retry/ }));
  await screen.findByText('recovered');
  expect(screen.getAllByText('question')).toHaveLength(1);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('network failure, malformed and empty responses are reported', async () => {
  const u = setup();
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  const box = screen.getByLabelText('Message to AI Analyst');
  global.fetch.mockRejectedValueOnce(new TypeError('fail'));
  await u.type(box, 'a{Enter}');
  expect((await screen.findByRole('alert')).textContent).toMatch(/Cannot reach/);
  global.fetch.mockResolvedValueOnce(ok({ unexpected: true }));
  await u.type(box, 'b{Enter}');
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/empty answer/));
  global.fetch.mockResolvedValueOnce(ok('just a string'));
  await u.type(box, 'c{Enter}');
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/unexpected response/));
});

test('API text is rendered as text, never HTML; identifiers are copyable', async () => {
  const u = setup();
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  global.fetch.mockResolvedValueOnce(ok({ reply: '<img src=x onerror="window.__xss=1"> Event 4728 from 192.168.1.10 for j.chen\n- item one\n```\nnet user x /delete\n```' }));
  await u.type(screen.getByLabelText('Message to AI Analyst'), 'q{Enter}');
  await screen.findByText(/Event/);
  expect(document.querySelector('.as-rich img')).toBeNull();
  expect(window.__xss).toBeUndefined();
  expect(screen.getByText(/<img src=x/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Copy 4728' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Copy 192.168.1.10' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Copy j.chen' })).toBeTruthy();
  expect(screen.getByText('Suggested only. Cyber DNA never runs this for you.')).toBeTruthy();
  expect(screen.getByText('item one').tagName).toBe('LI');
});

test('structured sections render with evidence kinds; new conversation clears', async () => {
  const u = setup();
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  global.fetch.mockResolvedValueOnce(ok({ reply: 'plain', sections: { summary: 'S', evidence: [{ text: 'E1', kind: 'confirmed' }, { text: 'E2', kind: 'hypothesis' }, 'E3', 'E4'], risk: 'R', next_steps: ['N1'] } }));
  await u.type(screen.getByLabelText('Message to AI Analyst'), 'q{Enter}');
  await screen.findByText('S');
  expect(screen.getByText('Confirmed')).toBeTruthy();
  expect(screen.getByText('Hypothesis')).toBeTruthy();
  expect(document.querySelector('details.as-evidence').open).toBe(false); // 4 items: collapsed by default
  expect(screen.getByText('N1')).toBeTruthy();
  await u.click(screen.getByRole('button', { name: 'New conversation' }));
  expect(screen.queryByText('S')).toBeNull();
  expect(screen.getByRole('heading', { name: /Ask about/ })).toBeTruthy();
});

test('in-flight answer is discarded after starting a new conversation', async () => {
  const u = setup();
  await u.click(screen.getByRole('button', { name: 'Open AI Analyst' }));
  let release; global.fetch.mockReturnValueOnce(new Promise((r) => { release = r; }));
  await u.type(screen.getByLabelText('Message to AI Analyst'), 'old{Enter}');
  await u.click(screen.getByRole('button', { name: 'New conversation' }));
  release(ok({ reply: 'stale' }));
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.queryByText('stale')).toBeNull();
});
