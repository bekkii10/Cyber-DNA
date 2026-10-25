import React, { useEffect, useRef, useState } from 'react';
import { BrainCircuit, RefreshCw, AlertTriangle, ChevronsDown } from 'lucide-react';
import { askAssistant, AssistantError } from '../api/assistant';

export default function AnalystExplanation({ context, question, title = 'AI explanation' }) {
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const requestId = useRef(0);
  const key = JSON.stringify(context || {});

  const run = async (prompt = question, deeper = false) => {
    if ((!context) || loading || moreLoading) return;
    const thisRequest = ++requestId.current;
    deeper ? setMoreLoading(true) : setLoading(true);
    setError('');
    try {
      const answer = await askAssistant({ message: prompt, context });
      if (requestId.current === thisRequest) {
        setResult(answer);
        if (deeper) setExpanded(true);
      }
    } catch (e) {
      if (requestId.current === thisRequest) {
        const msg = e instanceof AssistantError ? e.message : (e?.message || 'The AI Analyst request failed.');
        setError(msg);
      }
    } finally {
      if (requestId.current === thisRequest) {
        setLoading(false);
        setMoreLoading(false);
      }
    }
  };

  useEffect(() => {
    requestId.current += 1;
    setResult(null); setError(''); setExpanded(false);
    // Generate once for a newly selected record. The stable context key prevents
    // React rerenders/refreshes from issuing duplicate requests for the same evidence.
    if (context) {
      const timer = window.setTimeout(() => run(question), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const deepQuestion = `${question}

Generate More: expand this investigation using only retrieved Cyber DNA evidence. Add a concise UTC timeline, related events, relevant users/hosts/source IPs/event IDs, matching rules, ML findings and scores, plausible benign explanations, missing evidence, and prioritized investigation steps. Clearly separate verified facts, hypotheses, and recommendations. Do not claim any action was executed.`;

  return <section className="panel" style={{ padding: '1rem', marginBottom: '1rem' }} aria-live="polite">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        <BrainCircuit size={17} color="var(--c1)" /><h3 style={{ margin: 0, fontSize: '.95rem' }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(question)} disabled={loading || moreLoading || !context}>
          {loading ? <><RefreshCw size={14} className="spin" /> Analyzing…</> : <><BrainCircuit size={14} /> {result ? 'Refresh explanation' : 'Generate explanation'}</>}
        </button>
        {result && <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(deepQuestion, true)} disabled={loading || moreLoading}>
          {moreLoading ? <><RefreshCw size={14} className="spin" /> Generating…</> : <><ChevronsDown size={14} /> Generate More</>}
        </button>}
      </div>
    </div>
    {!result && !error && loading && <p className="muted" style={{ margin: '.65rem 0 0' }}>Analyzing the selected record using database-backed evidence…</p>}
    {!result && !error && !loading && <p className="muted" style={{ margin: '.65rem 0 0' }}>No explanation is shown until the backend returns evidence-based analysis.</p>}
    {error && <p role="alert" style={{ display: 'flex', gap: '.45rem', color: 'var(--high-solid)', margin: '.75rem 0 0' }}><AlertTriangle size={16} />{error}</p>}
    {result && <div style={{ marginTop: '.8rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
      <div className="badge plain" style={{ display: 'inline-flex', marginBottom: '.5rem' }}>
        {result.configured === false ? 'Evidence summary · external AI not configured' : result.providerStatus === 'connected' ? `AI Analyst${result.model ? ` · ${result.model}` : ''}` : 'Analyst response'}
      </div>
      {result.sections ? <>
        {result.sections.summary && <p><b>What happened?</b><br />{result.sections.summary}</p>}
        {result.sections.evidence?.length > 0 && <div><b>Why was it flagged?</b><ul>{result.sections.evidence.map((e, i) => <li key={i}>{e.text}</li>)}</ul></div>}
        {result.sections.risk && <p><b>Confidence and limitations</b><br />{result.sections.risk}</p>}
        {result.sections.next_steps?.length > 0 && <div><b>Recommendation</b><ol>{result.sections.next_steps.slice(0, expanded ? 8 : 4).map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
        {!result.sections.summary && !result.sections.evidence?.length && !result.sections.risk && !result.sections.next_steps?.length && <p>{result.text}</p>}
      </> : <p>{result.text}</p>}
    </div>}
  </section>;
}
