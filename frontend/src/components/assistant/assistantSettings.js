import { createStore, useStore } from '../../lib/createStore';

const KEY = 'cyberdna-ai-settings-v1';
export const AI_DEFAULTS = {
  responseStyle: 'balanced', // concise | balanced | detailed
  audience: 'analyst', // analyst | executive
  includePageContext: true,
  includeNote: false, // send an excerpt of the open notebook note with each question
  historyTurns: 12, // how many earlier messages are sent for follow-ups (0 = none)
  redact: false, // replace IPs, users and hosts with placeholders before sending; restored locally
  sendKey: 'enter', // enter | mod-enter
  compact: false,
  showTimestamps: true,
  selectionToolbar: true, // small Ask AI / Add to Notebook popover when text is selected on the page
};
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const pick = (v, ok, d) => (ok.includes(v) ? v : d);
const sane = (s) => ({
  ...AI_DEFAULTS, ...s,
  responseStyle: pick(s.responseStyle, ['concise', 'balanced', 'detailed'], AI_DEFAULTS.responseStyle),
  audience: pick(s.audience, ['analyst', 'executive'], AI_DEFAULTS.audience),
  sendKey: pick(s.sendKey, ['enter', 'mod-enter'], AI_DEFAULTS.sendKey),
  historyTurns: pick(Number(s.historyTurns), [0, 6, 12, 24], AI_DEFAULTS.historyTurns),
});
export const aiSettings = createStore(sane(read()));
export const setAiSettings = (patch) => {
  aiSettings.set((s) => sane({ ...s, ...patch }));
  try { localStorage.setItem(KEY, JSON.stringify(aiSettings.get())); } catch { /* storage unavailable */ }
};
export const resetAiSettings = () => setAiSettings({ ...AI_DEFAULTS });
export const useAiSettings = () => useStore(aiSettings);
