// Notebook AI actions. Each is a plain instruction sent through the existing assistant request path; results are only ever
// shown in a review card and never applied without the analyst choosing Replace or Insert.
export const GUARD = 'Never invent event IDs, usernames, IP addresses, hostnames, timestamps or evidence. If something is not in the text provided, say it is not recorded. Separate confirmed facts from hypotheses.';

export const AI_TASKS = {
  improve: { label: 'Improve writing', scope: 'selection', replace: true, prompt: 'Improve the clarity and professionalism of the text below. Keep every fact, identifier, timestamp and technical detail unchanged. Return only the rewritten text.' },
  concise: { label: 'Make concise', scope: 'selection', replace: true, prompt: 'Make the text below more concise without losing any fact, identifier, timestamp or technical detail. Return only the rewritten text.' },
  grammar: { label: 'Fix spelling and grammar', scope: 'selection', replace: true, prompt: 'Fix spelling and grammar in the text below and change nothing else. Return only the corrected text.' },
  explain: { label: 'Explain this', scope: 'selection', prompt: 'Explain the text below in plain language for a junior SOC analyst. Say what is established by the text and what is not.' },
  summarize: { label: 'Summarize', scope: 'selection', prompt: 'Summarize the text below in at most five bullet points, using only what is written.' },
  actions: { label: 'Extract action items', scope: 'note', prompt: 'Extract the action items from this note as bullets, with an owner if one is stated. Do not add actions the note does not imply.' },
  timeline: { label: 'Build UTC timeline from note', scope: 'note', prompt: 'Extract a chronological timeline of events from this note. Use only timestamps that appear in the note. If a time is missing write "time not recorded". Do not invent events.' },
  exec: { label: 'Draft executive summary', scope: 'note', prompt: 'Write an executive summary of this investigation in at most 120 words for a non-technical manager. State confirmed facts and open hypotheses separately.' },
  next: { label: 'Suggest next steps', scope: 'note', prompt: 'Based only on this note, suggest what to investigate next. Label each item as a hypothesis to test, not a conclusion.' },
  ask: { label: 'Ask AI…', scope: 'custom', prompt: '' },
};
export const buildMessage = (task, custom) => `${task.scope === 'custom' ? custom : task.prompt}\n\n${GUARD}`;
