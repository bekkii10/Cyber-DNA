import React, { useState } from 'react';
import { KeyRound, ArrowRight } from 'lucide-react';

export default function PasswordChange({ onComplete, onLogout }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError('');
    if (next.length < 12) return setError('Use at least 12 characters for the new password.');
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const response = await fetch(`${base}/auth/change-password`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: current, new_password: next }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || 'Could not update password.');
      onComplete();
    } catch (err) { setError(err.message || 'Password update failed.'); }
    finally { setBusy(false); }
  }
  return <main className="login"><section className="login-card" style={{ display: 'block', maxWidth: 520, margin: 'auto', padding: '2rem' }}><div className="secure-badge"><KeyRound size={16}/> Account security required</div><h1>Change your temporary password</h1><p className="lead">Choose a new password before entering Cyber DNA. Use at least 12 characters.</p><form onSubmit={submit}><label className="fld">Current temporary password<input type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required /></label><label className="fld">New password<input type="password" autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)} minLength={12} required /></label><label className="fld">Confirm new password<input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={12} required /></label>{error && <p className="form-note err" role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Updating…' : 'Update password'} <ArrowRight size={16}/></button></form><p className="switch"><button type="button" onClick={onLogout}>Sign out</button></p></section></main>;
}
