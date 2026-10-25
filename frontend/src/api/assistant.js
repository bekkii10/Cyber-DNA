// AI Analyst service. Reuses the shared API client (base URL, bearer token, JSON handling) from ./client.
//
// Endpoint: POST {API_BASE}/analyst/ask (override with VITE_ASSISTANT_ENDPOINT)
// Request:   { message: string,
//              history?: [{ role: 'user' | 'assistant', content: string }],   // earlier turns of this conversation only
//              context?: { page: string, search?: string, filters?: object, selection?: object } }
// Response:  { reply: string,                                                  // required plain-text answer
//              sections?: { summary?: string,
//                           evidence?: [string | { text: string, kind?: 'confirmed' | 'suspicious' | 'hypothesis' }],
//                           risk?: string, next_steps?: [string] } }
import { apiPost, ENDPOINTS } from './client';

export const ASSISTANT_PATH = import.meta.env.VITE_ASSISTANT_ENDPOINT || ENDPOINTS.assistantChat;
export const REQUEST_TIMEOUT_MS = 30000;
const MAX_HISTORY = 12;
const MAX_CONTENT = 4000;
const KINDS = ['confirmed', 'suspicious', 'hypothesis'];

export class AssistantError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

export function toAssistantError(err) {
  if (err instanceof AssistantError) return err;
  if (err?.name === 'AbortError') return new AssistantError('timeout', 'The request timed out. The analysis service did not answer in time.');
  const status = /^HTTP (\d{3})$/.exec(err?.message || '')?.[1];
  if (status) {
    const code = Number(status);
    if (code === 401) return new AssistantError('auth', 'Your session is not authorized for the AI Analyst. Sign in again and retry.');
    if (code === 403) return new AssistantError('forbidden', 'Your account does not have permission to use the AI Analyst.');
    if ([404, 405, 501].includes(code)) return new AssistantError('unavailable', `The AI Analyst service is not available on this backend (${code}). The conversation endpoint ${ASSISTANT_PATH} has not been implemented yet.`);
    if (code === 429) return new AssistantError('rate', 'Too many requests. Wait a moment and retry.');
    if (code >= 500) return new AssistantError('server', `The analysis service reported an error (${code}). Retry in a moment.`);
    return new AssistantError('http', `The request was rejected (${code}).`);
  }
  if (err instanceof TypeError) return new AssistantError('network', 'Cannot reach the Cyber DNA API. Check your connection and retry.');
  if (err?.message === 'Not JSON' || err instanceof SyntaxError) return new AssistantError('malformed', 'The service returned a response that is not valid JSON.');
  return new AssistantError('unknown', 'The request failed for an unknown reason.');
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const list = (v) => (Array.isArray(v) ? v : []);

// Validate the response shape; never fabricate content that the service did not return.
export function parseReply(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AssistantError('malformed', 'The service returned an unexpected response format.');
  // A provider failure may arrive with HTTP 200 from the backend. Never display it as a successful AI answer.
  if (data.configured === true && data.provider_status && data.provider_status !== 'connected') {
    const code = String(data.error_code || data.provider_status);
    const messages = {
      invalid_api_key: 'OpenAI rejected the API key. Check backend/.env and restart the backend.',
      model_access_denied: 'The configured OpenAI model is not available to this API account.',
      model_not_found_or_unavailable: 'The configured OpenAI model was not found or is unavailable to this API account.',
      rate_limited_or_quota_exceeded: 'OpenAI rate limit or quota was reached. Check API usage and billing, then retry.',
      provider_timeout: 'OpenAI did not respond before the configured timeout. Retry in a moment.',
      provider_connection_error: 'The backend could not connect to OpenAI. Check network connectivity and retry.',
      provider_request_failed: 'OpenAI rejected or failed the request. Check backend provider status and logs.',
    };
    throw new AssistantError('provider', messages[code] || `OpenAI request failed (${code}). No AI answer was generated.`);
  }
  const s = data.sections && typeof data.sections === 'object' ? data.sections : null;
  const sections = s ? {
    summary: str(s.summary),
    evidence: list(s.evidence).map((e) => (typeof e === 'string' ? { text: e.trim() } : { text: str(e?.text), kind: KINDS.includes(e?.kind) ? e.kind : undefined })).filter((e) => e.text),
    risk: str(s.risk),
    next_steps: list(s.next_steps).map(str).filter(Boolean),
  } : null;
  const hasSections = !!sections && (sections.summary || sections.evidence.length || sections.risk || sections.next_steps.length);
  const reply = str(data.reply);
  if (!reply && !hasSections) throw new AssistantError('empty', 'The service returned an empty answer.');
  const text = reply || [sections.summary, ...sections.evidence.map((e) => `- ${e.text}`), sections.risk, ...sections.next_steps.map((n) => `- ${n}`)].filter(Boolean).join('\n');
  return { text, sections: hasSections ? sections : null, configured: data.configured, providerStatus: data.provider_status || null, model: data.model || null };
}

export async function askAssistant({ message, history = [], context }) {
  const body = {
    message,
    history: history.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_CONTENT) })),
    ...(context ? { context } : {}),
  };
  try {
    return parseReply(await apiPost(ASSISTANT_PATH, body, REQUEST_TIMEOUT_MS));
  } catch (e) {
    throw toAssistantError(e);
  }
}
