// Renders the real App shell and pages with stubbed fetch. Alerts/users come from the stub; /assistant/chat uses the PROPOSED contract.
import React from 'react';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';

const json = (b) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => b });
const ALERTS = [{ id: 'ALT-1', severity: 'high', rule: 'Brute force', score: 71, user: 'a.smith', host: 'WS07', ip: '10.0.0.5', time: '2026-10-01T10:00:00Z', detail: 'Many failed logons', event_id: '4625', explanation: 'Stored text' }];
const USERS = [{ username: 'a.smith', department: 'Finance', risk_score: 64, what_happened: 'W', what_it_means: 'M', recommendation: 'R' }];

beforeEach(() => {
  Element.prototype.scrollTo = () => {}; // jsdom does not implement scrollTo
  sessionStorage.setItem('cyberdna-splash', '1'); sessionStorage.setItem('cyberdna-session', '1');
  window.location.hash = '#/alerts';
  global.fetch = vi.fn(async (url, o) => {
    if (String(url).includes('/assistant/chat')) return json({ reply: 'ok reply' });
    if (String(url).endsWith('/alerts')) return json(ALERTS);
    if (String(url).endsWith('/users')) return json(USERS);
    return { ok: false, status: 404, headers: { get: () => 'application/json' }, json: async () => ({}) };
  });
});
afterEach(cleanup);

test('dashboard navigation still works and the assistant receives page + selected item context', async () => {
  const u = userEvent.setup();
  render(<App />);
  await u.click(await screen.findByRole('button', { name: 'Open AI Analyst' }));
  // No alert expanded yet: only page context, no selection.
  expect(document.querySelector('.as-chip-ctx .as-chip-label').textContent).toBe('Alerts');
  await u.click(await screen.findByRole('button', { name: 'Brute force' }));
  await screen.findByText('Alert ALT-1');
  await u.click(screen.getByRole('button', { name: 'Explain this alert in simple terms' }));
  await screen.findByText('ok reply');
  const call = global.fetch.mock.calls.find(([url]) => String(url).includes('/assistant/chat'));
  const body = JSON.parse(call[1].body);
  expect(body.context.page).toBe('Alerts');
  expect(body.context.selection).toMatchObject({ type: 'alert', id: 'ALT-1', eventId: '4625', user: 'a.smith', host: 'WS07', sourceIp: '10.0.0.5', riskScore: 71 });
  // Navigate via the sidebar: the dashboard still changes pages and the conversation persists.
  await u.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'User Behavior' }));
  await screen.findByText('Monitored users');
  expect(screen.getByText('ok reply')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('User a.smith')).toBeTruthy());
});
