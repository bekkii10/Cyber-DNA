import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, ArrowRight, Zap, ShieldCheck, Headphones, Sun, Moon, ArrowLeft } from 'lucide-react';
import { Brand, BrandMark } from './Brand';

const REMEMBER = 'cyberdna-remember';

// Startup animation shown once per browser session. Click or key press skips it.
export function Splash({ onDone, reduced }) {
  const [step, setStep] = useState(0);
  const msgs = ['Initializing analytics engine…', 'Connecting to Active Directory sources…', 'Ready'];
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), reduced ? 150 : 700);
    const t2 = setTimeout(() => setStep(2), reduced ? 300 : 1400);
    const t3 = setTimeout(onDone, reduced ? 450 : 2100);
    const skip = () => onDone();
    document.addEventListener('keydown', skip);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); document.removeEventListener('keydown', skip); };
  }, [onDone, reduced]);
  return (
    <div className="splash" onClick={onDone} role="status" aria-live="polite">
      <div className="splash-in">
        <BrandMark size={34} />
        <h1>CYBER DNA</h1>
        <p>Behavioral threat analytics for Active Directory</p>
        <div className="splash-bar"><i /></div>
        <small>{msgs[step]}</small>
      </div>
    </div>
  );
}

export default function Login({ onLogin, theme, toggleTheme, notice }) {
  const saved = (() => { try { return localStorage.getItem(REMEMBER) || ''; } catch { return ''; } })();
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState(saved);
  const [pass, setPass] = useState('');
  const [remember, setRemember] = useState(Boolean(saved));
  const [error, setError] = useState('');
  const [info, setInfo] = useState(notice || '');

  const reset = (m) => { setMode(m); setError(''); setInfo(''); setPass(''); };

  const submit = (e) => {
    e.preventDefault();
    setInfo('');
    if (!email.trim()) return setError('Enter your username or email address.');
    if (mode === 'forgot') { setError(''); return setInfo('If an account exists for that address, password reset instructions have been sent. (Demo: connect this to the backend.)'); }
    if (!pass) return setError('Enter your password.');
    if (mode === 'signup' && pass.length < 8) return setError('Use at least 8 characters for your password.');
    try { remember ? localStorage.setItem(REMEMBER, email.trim()) : localStorage.removeItem(REMEMBER); } catch { /* ignore */ }
    setError('');
    onLogin();
  };

  const titles = { login: ['Log in to Cyber DNA', 'Enter your username or email and password to continue.'], signup: ['Create your account', 'Set up analyst access to start using Cyber DNA.'], forgot: ['Reset your password', 'Enter your username or email and we’ll send reset instructions.'] };

  return (
    <div className="login">
      <button
        type="button"
        className="icon-btn login-theme"
        onClick={toggleTheme}
        aria-label="Change theme"
        title={`Current: ${theme}`}
      >
        {theme === 'light' ? <Moon size={18} /> : theme === 'dark' ? <Sun size={18} /> : <span style={{ fontSize: 16 }}>🔥</span>}
      </button>
      <div className="login-card">
        <section className="login-left">
          <Brand onClick={() => reset('login')} label="Cyber DNA — back to log in" />
          <span className="eyebrow">ACTIVE DIRECTORY SECURITY</span>
          <h1>{mode === 'signup' ? 'Create your analyst account.' : 'Welcome back.'}</h1>
          <p>{mode === 'signup' ? 'Set up your analyst access to start using Cyber DNA.' : 'Log in to continue monitoring, detecting and understanding behavior across your AD environment.'}</p>
          <div className="login-points">
            <div><Zap aria-hidden="true" /><b>Fast and reliable</b><small>Built for focused security operations</small></div>
            <div><ShieldCheck aria-hidden="true" /><b>Secure by design</b><small>Your dashboard stays protected</small></div>
            <div><Headphones aria-hidden="true" /><b>Analyst focused</b><small>Clear insights when you need them</small></div>
          </div>
        </section>
                <section className="login-form">
          <Brand onClick={() => reset('login')} label="Cyber DNA — back to log in" />
          <div className="secure-badge">
            <span className="pulse-dot" />
            Secure connection
          </div>
          <h2>{titles[mode][0]}</h2>
          <p className="lead">{titles[mode][1]}</p>
          <form onSubmit={submit} noValidate>
            <label className="fld">Username or email
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@corp.local or username" autoComplete="username" />
            </label>
            {mode !== 'forgot' && (
              <label className="fld">Password
                <span className="pw">
                  <input type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </span>
              </label>
            )}
            {error && <div className="form-note err" role="alert">{error}</div>}
            {info && <div className="form-note info" role="status">{info}</div>}
            {mode === 'login' && (
              <div className="remember" style={{ marginTop: '.9rem' }}>
                <label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
                <button type="button" className="link-btn" onClick={() => reset('forgot')}>Forgot password?</button>
              </div>
            )}
            <button className="btn btn-primary" type="submit" style={{ marginTop: mode === 'login' ? 0 : '1rem' }}>
              {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'} <ArrowRight size={16} />
            
           </button>
          </form>
          {mode === 'forgot' ? (
            <p className="switch"><button type="button" onClick={() => reset('login')}><ArrowLeft size={14} style={{ verticalAlign: '-2px' }} /> Back to log in</button></p>
          ) : (
            <>
              <div className="or">or</div>
              <button className="btn btn-secondary" type="button" onClick={onLogin}><span className="g-mark">G</span> Continue with Google</button>
              <p className="switch">{mode === 'login' ? 'Don’t have an account?' : 'Already have an account?'} <button type="button" onClick={() => reset(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Sign up' : 'Log in'}</button></p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
