import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { askAssistant, AssistantError, toAssistantError } from '../../api/assistant';
import { clean, identifiersOf } from './contextBuilders';
import { aiSettings, useAiSettings } from './assistantSettings';
import { createRedactor } from './redact';
import { store as noteStore } from '../../notebook/notebookStore';
import { htmlToText } from '../../notebook/sanitize';

const Ctx = createContext(null);
export const useAssistant = () => useContext(Ctx);

// Pages publish what the analyst is looking at: { label?, selection?, filters? }. Cleared automatically on unmount.
export function useAssistantContext(ctx) {
  const a = useAssistant();
  const set = a?.setPageContext;
  const key = ctx ? JSON.stringify(ctx) : '';
  useEffect(() => {
    if (!set) return undefined;
    set(key ? JSON.parse(key) : null);
    return () => set(null);
  }, [set, key]);
}

let seq = 0;
const nid = () => `m${Date.now().toString(36)}${(seq += 1)}`;
const MAX_EXCERPT = 4000;
const MAX_NOTE = 6000;

// What may be sent from the open note. TLP:RED notes never leave the browser through the AI path.
export function noteForAi() {
  const s = noteStore.get(); const n = s.notes.find((x) => x.id === s.activeId);
  if (!n) return { blocked: 'No note is open.' };
  if (n.tlp === 'RED') return { blocked: 'TLP:RED notes are never sent to the AI service.', title: n.title };
  const text = htmlToText(n.html);
  if (!text.trim()) return { blocked: 'The open note is empty.', title: n.title };
  return { title: n.title, tlp: n.tlp, text: text.slice(0, MAX_NOTE), truncated: text.length > MAX_NOTE };
}

// Build the exact request: settings -> context/options -> optional redaction. Returns what is sent and how to restore the answer.
export function prepareRequest({ message, history, context, settings, extraContext }) {
  const ctx = clean({ ...(context || {}), ...(extraContext || {}) });
  const payload = {
    message,
    history: settings.historyTurns ? history.slice(-settings.historyTurns).map((m) => ({ role: m.role, content: m.content })) : [],
    ...(Object.keys(ctx).length ? { context: ctx } : {}),
    options: { responseStyle: settings.responseStyle, audience: settings.audience, redacted: !!settings.redact },
  };
  if (!settings.redact) return { payload, restore: (x) => x, redactions: 0 };
  const r = createRedactor(payload);
  return { payload: r.redacted, restore: r.restore, redactions: r.count };
}

function restoreResult(res, restore) {
  const s = res.sections;
  return {
    text: restore(res.text),
    sections: s ? { summary: restore(s.summary), risk: restore(s.risk), evidence: s.evidence.map((e) => ({ ...e, text: restore(e.text) })), next_steps: s.next_steps.map(restore) } : null,
  };
}

// Conversation lives in memory only: it survives closing/reopening the panel and page navigation, and is cleared on reload or sign-out.
export function AssistantProvider({ page, query, children }) {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [pageCtx, setPageContext] = useState(null);
  const [includeCtx, setIncludeCtx] = useState(true);
  const [excerpt, setExcerpt] = useState(null); // { text, from } one-shot selection the analyst attached
  const [noteOn, setNoteOn] = useState(false); // attach the open note for the next questions
  const [seed, setSeed] = useState(null); // { text, nonce } prefill for the composer
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useAiSettings();
  useEffect(() => { setIncludeCtx(settings.includePageContext); }, [settings.includePageContext]);
  const busy = useRef(false);
  const gen = useRef(0);
  const msgs = useRef(messages); msgs.current = messages;

  const context = useMemo(() => clean({ page, search: query?.trim(), filters: pageCtx?.filters && clean(pageCtx.filters), selection: pageCtx?.selection }), [page, query, pageCtx]);
  const live = useRef({}); live.current = { context, includeCtx, excerpt, noteOn: noteOn || settings.includeNote };

  const attachments = () => {
    const l = live.current; const extra = {};
    if (l.excerpt) extra.excerpt = { text: l.excerpt.text.slice(0, MAX_EXCERPT), from: l.excerpt.from };
    if (l.noteOn) { const n = noteForAi(); if (!n.blocked) extra.note = { title: n.title, tlp: n.tlp, text: n.text }; }
    return extra;
  };

  const run = useCallback(async (userMsg, history) => {
    const mine = gen.current; busy.current = true; setPending(true);
    try {
      const s = aiSettings.get();
      const req = prepareRequest({ message: userMsg.content, history, context: userMsg.ctx, extraContext: userMsg.extra, settings: s });
      const raw = await askAssistant({ message: req.payload.message, history: req.payload.history, context: req.payload.context, options: req.payload.options });
      if (mine !== gen.current) return false;
      const res = restoreResult(raw, req.restore);
      setMessages((m) => [...m.map((x) => (x.id === userMsg.id ? { ...x, status: 'ok', sent: { context: req.payload.context, options: req.payload.options, redactions: req.redactions } } : x)),
        { id: nid(), role: 'assistant', content: res.text, sections: res.sections, ts: Date.now(), status: 'ok', ids: userMsg.ids }]);
      return true;
    } catch (e) {
      if (mine !== gen.current) return false;
      const err = e instanceof AssistantError ? e : toAssistantError(e);
      setMessages((m) => m.map((x) => (x.id === userMsg.id ? { ...x, status: 'failed', error: { kind: err.kind, message: err.message } } : x)));
      return false;
    } finally {
      if (mine === gen.current) { busy.current = false; setPending(false); }
    }
  }, []);

  const send = useCallback(async (raw, retryId) => {
    const text = String(raw ?? '').trim();
    if (!text || busy.current) return false; // blocks duplicate submissions while a request is in flight
    const prior = msgs.current;
    if (retryId) {
      const idx = prior.findIndex((m) => m.id === retryId); if (idx < 0) return false;
      const userMsg = { ...prior[idx], status: 'pending', error: null };
      setMessages(prior.map((x) => (x.id === retryId ? userMsg : x)));
      return run(userMsg, prior.slice(0, idx).filter((m) => m.status === 'ok'));
    }
    const l = live.current; const ctx = l.includeCtx ? l.context : null; const extra = attachments();
    const userMsg = { id: nid(), role: 'user', content: text, ts: Date.now(), status: 'pending', ctx, extra, ids: identifiersOf(ctx?.selection), attached: { excerpt: !!extra.excerpt, note: !!extra.note } };
    setMessages([...prior.filter((m) => m.status !== 'failed'), userMsg]); // a newer question supersedes an unsent failed one
    if (l.excerpt) setExcerpt(null);
    return run(userMsg, prior.filter((m) => m.status === 'ok'));
  }, [run]);

  const retry = useCallback((id) => { const m = msgs.current.find((x) => x.id === id); if (m) send(m.content, id); }, [send]);
  const cancel = useCallback(() => {
    if (!busy.current) return;
    gen.current += 1; busy.current = false; setPending(false);
    setMessages((m) => m.map((x) => (x.status === 'pending' ? { ...x, status: 'failed', error: { kind: 'cancelled', message: 'Request cancelled.' } } : x)));
  }, []);
  const regenerate = useCallback(() => {
    if (busy.current) return;
    const list = msgs.current; const i = list.map((m) => m.role).lastIndexOf('user'); if (i < 0) return;
    const um = list[i]; const kept = list.slice(0, i + 1);
    msgs.current = kept; setMessages(kept); send(um.content, um.id);
  }, [send]);
  const newConversation = useCallback(() => { gen.current += 1; busy.current = false; setPending(false); setMessages([]); setExcerpt(null); }, []);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  // Entry points used by the rest of the dashboard (selection toolbar, context menu, palette, notebook).
  const askAbout = useCallback((text, { from = 'Selected text', prompt, autoSend = false, selection } = {}) => {
    if (selection) setPageContext((p) => ({ ...(p || {}), selection }));
    if (text) setExcerpt({ text: String(text).slice(0, MAX_EXCERPT), from });
    setOpen(true);
    if (prompt) { if (autoSend) setTimeout(() => send(prompt), 0); else setSeed({ text: prompt, nonce: Date.now() }); }
  }, [send]);
  const prefill = useCallback((text) => { setOpen(true); setSeed({ text, nonce: Date.now() }); }, []);

  // One-shot call for the notebook (not added to the conversation). Same settings, redaction and TLP rules.
  const askOnce = useCallback(async ({ message, selectionText, includeNote }) => {
    const s = aiSettings.get();
    const extra = {};
    if (selectionText) extra.excerpt = { text: selectionText.slice(0, MAX_EXCERPT), from: 'Security Notebook selection' };
    if (includeNote) { const n = noteForAi(); if (n.blocked) throw new AssistantError('blocked', n.blocked); extra.note = { title: n.title, tlp: n.tlp, text: n.text }; }
    const req = prepareRequest({ message, history: [], context: { page: 'Security Notebook' }, extraContext: extra, settings: s });
    const raw = await askAssistant({ message: req.payload.message, history: [], context: req.payload.context, options: req.payload.options });
    return restoreResult(raw, req.restore);
  }, []);

  const value = useMemo(() => ({
    open, wide, setWide, messages, pending, context, pageCtx, includeCtx, setIncludeCtx, excerpt, setExcerpt, noteOn, setNoteOn, seed,
    settingsOpen, setSettingsOpen, setPageContext, send, retry, cancel, regenerate, newConversation, toggle, close, askAbout, prefill, askOnce, setOpen,
  }), [open, wide, messages, pending, context, pageCtx, includeCtx, excerpt, noteOn, seed, settingsOpen, send, retry, cancel, regenerate, newConversation, toggle, close, askAbout, prefill, askOnce]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
