import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api } from '../services/api';
import Avatar from '../components/Avatar';

export default function Dashboard() {
  const [roomCode, setRoomCode] = useState('');
  const [loading,  setLoading]  = useState('');
  const [error,    setError]    = useState('');
  const user      = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate  = useNavigate();

  async function createRoom() {
    setLoading('create'); setError('');
    try {
      const { code } = await api.rooms.create({ name: `${user?.username}'s room`, type: 'watch' });
      navigate(`/room/${code}`);
    } catch (err) { setError(err.message); }
    finally { setLoading(''); }
  }

  async function joinRoom() {
    const code = roomCode.trim().toUpperCase();
    if (code.length < 6) return;
    setLoading('join'); setError('');
    try {
      await api.rooms.join(code);
      navigate(`/room/${code}`);
    } catch (err) { setError(err.message); }
    finally { setLoading(''); }
  }

  return (
    <div style={S.page}>
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header style={S.topBar}>
        <div style={S.brandRow}>
          <div style={S.logoMark}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/>
            </svg>
          </div>
          <span style={S.brandName}>ETC</span>
        </div>
        <button style={S.avatarBtn} onClick={() => { clearAuth(); navigate('/login'); }} title="Sign out">
          <Avatar name={user?.username || '?'} size={34} />
        </button>
      </header>

      {/* ── Scroll content ───────────────────────────────────────────── */}
      <main style={S.main}>
        {/* Welcome */}
        <div style={S.welcome}>
          <Avatar name={user?.username || '?'} size={56} />
          <div>
            <h1 style={S.wName}>Hey, {user?.username || 'there'} 👋</h1>
            <p style={S.wSub}>What are we watching today?</p>
          </div>
        </div>

        {error && <div style={S.errBox}>{error}</div>}

        {/* ── Create room card ──────────────────────────────────────── */}
        <div style={S.createCard}>
          <div style={S.createLeft}>
            <span style={S.createEmoji}>🎬</span>
            <div>
              <h2 style={S.createTitle}>Start a room</h2>
              <p style={S.createDesc}>Watch together, talk live, queue videos</p>
            </div>
          </div>
          <button style={S.createBtn} onClick={createRoom} disabled={loading === 'create'}>
            {loading === 'create' ? <Spin light /> : 'Start'}
          </button>
        </div>

        {/* ── Join room ────────────────────────────────────────────── */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>Join a room</h2>
          <p style={S.sectionSub}>Enter the 6-character code your friend shared</p>
          <input
            style={S.codeInput}
            placeholder="Enter room code"
            maxLength={6}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          />
          <button
            style={{ ...S.joinBtn, ...(roomCode.length < 6 ? S.joinBtnDim : {}) }}
            onClick={joinRoom}
            disabled={roomCode.length < 6 || loading === 'join'}
          >
            {loading === 'join' ? <Spin /> : 'Join Room'}
          </button>
        </div>

        {/* ── Feature grid ─────────────────────────────────────────── */}
        <div style={S.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.label} style={S.featureCard}>
              <span style={S.featureIcon}>{f.icon}</span>
              <span style={S.featureLabel}>{f.label}</span>
            </div>
          ))}
        </div>

        <div style={S.signOutRow}>
          <button style={S.signOutBtn} onClick={() => { clearAuth(); navigate('/login'); }}>
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}

const Spin = ({ light }) => (
  <span style={{ display:'inline-block', width:16, height:16, border:`2px solid ${light ? 'rgba(255,255,255,0.4)' : 'rgba(124,58,237,0.3)'}`, borderTopColor: light ? '#fff' : 'var(--brand)', borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
);

const FEATURES = [
  { icon: '🔄', label: 'Synced video' },
  { icon: '🎙️', label: 'Live voice' },
  { icon: '💬', label: 'Live chat' },
  { icon: '🎵', label: 'Queue' },
  { icon: '🔥', label: 'Reactions' },
  { icon: '🔗', label: 'Invite link' },
];

const S = {
  page:   { minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' },

  topBar: {
    height: 56, display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'0 16px', background:'var(--bg)',
    borderBottom:'1px solid var(--bg-3)',
    position:'sticky', top:0, zIndex:50,
  },
  brandRow:  { display:'flex', alignItems:'center', gap:8 },
  logoMark:  { width:30, height:30, borderRadius:9, background:'var(--grad)', display:'flex', alignItems:'center', justifyContent:'center' },
  brandName: { fontSize:'1.1rem', fontWeight:900, color:'var(--txt)', letterSpacing:'-0.5px' },
  avatarBtn: { background:'none', border:'none', cursor:'pointer', padding:0, borderRadius:'50%' },

  main: {
    flex:1, padding:'20px 16px 32px',
    maxWidth:520, width:'100%', margin:'0 auto',
    display:'flex', flexDirection:'column', gap:20,
    animation:'fadeUp 0.3s var(--ease)',
  },

  welcome: { display:'flex', alignItems:'center', gap:14 },
  wName:   { fontSize:'1.35rem', fontWeight:800, color:'var(--txt)', letterSpacing:'-0.5px' },
  wSub:    { fontSize:'0.88rem', color:'var(--txt-2)', marginTop:2 },

  errBox:  { background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:'var(--r-md)', color:'#be123c', padding:'10px 14px', fontSize:'0.85rem' },

  /* Create card */
  createCard: {
    background:'var(--grad)', borderRadius:'var(--r-xl)',
    padding:'20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
    boxShadow:'0 8px 32px rgba(124,58,237,0.25)',
  },
  createLeft:  { display:'flex', alignItems:'center', gap:14 },
  createEmoji: { fontSize:'2.4rem', lineHeight:1 },
  createTitle: { fontSize:'1.05rem', fontWeight:800, color:'#fff', marginBottom:2 },
  createDesc:  { fontSize:'0.82rem', color:'rgba(255,255,255,0.75)', lineHeight:1.4 },
  createBtn: {
    padding:'11px 20px', background:'rgba(255,255,255,0.2)', color:'#fff',
    border:'1.5px solid rgba(255,255,255,0.4)', borderRadius:'var(--r-full)',
    fontSize:'0.92rem', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
    flexShrink:0, display:'flex', alignItems:'center', gap:6,
    backdropFilter:'blur(8px)',
  },

  /* Join section */
  section:     { background:'var(--bg-2)', borderRadius:'var(--r-xl)', padding:'20px' },
  sectionTitle:{ fontSize:'1rem', fontWeight:700, color:'var(--txt)', marginBottom:4 },
  sectionSub:  { fontSize:'0.83rem', color:'var(--txt-2)', marginBottom:14 },
  codeInput: {
    width:'100%', padding:'14px 16px', marginBottom:10,
    background:'var(--bg)', border:'1.5px solid var(--bg-4)',
    borderRadius:'var(--r-md)', color:'var(--txt)',
    fontSize:'1.4rem', fontWeight:800, letterSpacing:'0.25em',
    textAlign:'center', textTransform:'uppercase', outline:'none',
  },
  joinBtn: {
    width:'100%', padding:'13px',
    background:'var(--txt)', color:'#fff', border:'none',
    borderRadius:'var(--r-md)', fontSize:'0.97rem', fontWeight:700, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
    transition:'opacity var(--t)',
  },
  joinBtnDim: { opacity:0.25, cursor:'not-allowed' },

  /* Feature grid */
  featureGrid: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 },
  featureCard: {
    background:'var(--bg-2)', borderRadius:'var(--r-lg)', padding:'14px 10px',
    display:'flex', flexDirection:'column', alignItems:'center', gap:6,
  },
  featureIcon:  { fontSize:'1.6rem' },
  featureLabel: { fontSize:'0.75rem', fontWeight:600, color:'var(--txt-2)', textAlign:'center' },

  signOutRow: { display:'flex', justifyContent:'center', paddingTop:4 },
  signOutBtn: { background:'none', border:'none', color:'var(--txt-2)', fontSize:'0.85rem', cursor:'pointer', padding:'6px 12px' },
};
