import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api } from '../services/api';

export default function Login() {
  const [mode,     setMode]     = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const setAuth  = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  function switchMode(next) {
    setMode(next); setError(''); setPassword(''); setConfirm('');
  }

  async function submit() {
    setError('');
    if (!username.trim() || !password) { setError('Please fill in all fields.'); return; }
    if (mode === 'register') {
      if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
      if (password.length < 6)        { setError('Password must be at least 6 characters.'); return; }
      if (password !== confirm)        { setError("Passwords don't match."); return; }
    }
    setLoading(true);
    try {
      const { token, user } = mode === 'register'
        ? await api.auth.register(username.trim(), password)
        : await api.auth.login(username.trim(), password);
      setAuth(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoMark}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/>
            </svg>
          </div>
        </div>
        <h1 style={S.appName}>ETC</h1>
        <p style={S.tagline}>Easy Talk & Connect</p>

        {/* Tab toggle */}
        <div style={S.tabs}>
          {['login', 'register'].map((m) => (
            <button key={m} style={{ ...S.tab, ...(mode === m ? S.tabOn : {}) }} onClick={() => switchMode(m)}>
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
          <div style={{ ...S.tabSlider, transform: `translateX(${mode === 'login' ? '0%' : '100%'})` }} />
        </div>

        {error && <div style={S.err}>{error}</div>}

        <div style={S.fields}>
          <input style={S.input} type="text" placeholder="Username" value={username} autoComplete="username"
            onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
          <input style={S.input} type="password" placeholder="Password" value={password}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          {mode === 'register' && (
            <input style={S.input} type="password" placeholder="Confirm password" value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          )}
        </div>

        <button style={{ ...S.btn, ...(loading ? S.btnBusy : {}) }} onClick={submit} disabled={loading}>
          {loading ? <Spin /> : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <p style={S.switchHint}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span style={S.switchLink} onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  );
}

const Spin = () => (
  <span style={{ display:'inline-block', width:18, height:18, border:'2.5px solid rgba(255,255,255,0.35)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
);

const S = {
  page: {
    minHeight: '100vh', background: 'var(--bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px 20px',
  },
  card: {
    width: '100%', maxWidth: 380,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    animation: 'fadeUp 0.3s var(--ease)',
  },
  logoWrap: {
    width: 72, height: 72, borderRadius: 22,
    background: 'var(--grad)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    boxShadow: '0 8px 32px rgba(124,58,237,0.35)',
  },
  appName:  { fontSize: '2rem', fontWeight: 900, color: 'var(--txt)', letterSpacing: '-1px', marginBottom: 4 },
  tagline:  { fontSize: '0.9rem', color: 'var(--txt-2)', marginBottom: 32 },

  tabs: {
    display: 'flex', width: '100%',
    background: 'var(--bg-3)', borderRadius: 'var(--r-full)',
    padding: 4, marginBottom: 20, position: 'relative', overflow: 'hidden',
  },
  tab: {
    flex: 1, padding: '10px', border: 'none', background: 'transparent',
    color: 'var(--txt-2)', fontWeight: 600, fontSize: '0.9rem',
    cursor: 'pointer', borderRadius: 'var(--r-full)', position: 'relative', zIndex: 1,
    transition: 'color var(--t)',
  },
  tabOn: { color: 'var(--txt)' },
  tabSlider: {
    position: 'absolute', top: 4, left: 4,
    width: 'calc(50% - 4px)', height: 'calc(100% - 8px)',
    background: 'white', borderRadius: 'var(--r-full)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
    transition: 'transform 0.22s var(--ease)',
    pointerEvents: 'none',
  },

  err: {
    width: '100%', background: '#fff1f2', border: '1px solid #fecdd3',
    borderRadius: 'var(--r-md)', color: '#be123c',
    padding: '10px 14px', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center',
  },

  fields: { display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginBottom: 14 },
  input: {
    width: '100%', padding: '14px 16px',
    background: 'var(--bg-3)', border: '1.5px solid transparent',
    borderRadius: 'var(--r-md)', color: 'var(--txt)',
    fontSize: '0.97rem', outline: 'none',
    transition: 'border-color var(--t), background var(--t)',
  },

  btn: {
    width: '100%', padding: '14px',
    background: 'var(--grad)', color: '#fff', border: 'none',
    borderRadius: 'var(--r-md)', fontSize: '1rem', fontWeight: 700,
    cursor: 'pointer', marginBottom: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 18px rgba(124,58,237,0.3)',
    transition: 'opacity var(--t)',
  },
  btnBusy: { opacity: 0.65, cursor: 'not-allowed' },

  switchHint: { fontSize: '0.87rem', color: 'var(--txt-2)' },
  switchLink: { color: 'var(--brand)', fontWeight: 600, cursor: 'pointer' },
};
