import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/auth';
import Avatar from '../components/Avatar';

const Back = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;

export default function Profile() {
  const { id }    = useParams();          // undefined → own profile
  const navigate  = useNavigate();
  const me        = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [profile, setProfile]  = useState(null);
  const [bio,     setBio]      = useState('');
  const [editing, setEditing]  = useState(false);
  const [saving,  setSaving]   = useState(false);
  const [loading, setLoading]  = useState(true);

  const isOwn = !id || id === me?.id;
  const targetID = id || me?.id;

  useEffect(() => { load(); }, [targetID]);

  async function load() {
    setLoading(true);
    try {
      const p = isOwn ? await api.social.getMyProfile() : await api.social.getProfile(targetID);
      setProfile(p);
      setBio(p.bio || '');
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function saveBio() {
    setSaving(true);
    try {
      await api.social.updateBio(bio);
      setProfile((prev) => ({ ...prev, bio }));
      setEditing(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleFriendAction() {
    if (!profile) return;
    if (profile.is_incoming) { await api.social.acceptRequest(targetID); }
    else if (!profile.is_friend && !profile.is_pending) { await api.social.sendRequest(targetID); }
    load();
  }

  async function openDM() {
    try {
      const conv = await api.dm.getOrCreateDirect(targetID);
      navigate(`/conversation/${conv.id}`);
    } catch { /* ignore */ }
  }

  function friendBtnLabel() {
    if (profile?.is_friend)   return 'Friends ✓';
    if (profile?.is_pending)  return 'Request Sent';
    if (profile?.is_incoming) return 'Accept Request';
    return 'Add Friend';
  }

  function friendBtnStyle() {
    if (profile?.is_friend)  return { ...S.actionBtn, background: 'var(--bg-3)', color: 'var(--txt-2)' };
    if (profile?.is_incoming) return { ...S.actionBtn, background: 'var(--green)', color: '#fff' };
    return { ...S.actionBtn, background: 'var(--grad)', color: '#fff' };
  }

  if (loading) return <div style={S.loading}>Loading…</div>;
  if (!profile) return <div style={S.loading}>User not found.</div>;

  const displayName = profile.display_name || profile.username;
  const initials    = profile.username;

  return (
    <div style={S.page}>
      {/* Header */}
      {!isOwn && (
        <header style={S.header}>
          <button style={S.backBtn} onClick={() => navigate(-1)}><Back /></button>
          <span style={S.headerTitle}>{profile.username}</span>
          <div style={{ width: 36 }} />
        </header>
      )}
      {isOwn && (
        <header style={S.header}>
          <h1 style={S.title}>Profile</h1>
          <button style={S.signOutBtn} onClick={() => { clearAuth(); navigate('/login'); }}>Sign out</button>
        </header>
      )}

      <div style={S.body}>
        {/* Cover + avatar */}
        <div style={S.cover}>
          <div style={S.coverGrad} />
        </div>
        <div style={S.avatarWrap}>
          <Avatar name={initials} size={80} style={{ border: '3px solid #fff', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }} />
        </div>

        {/* Info */}
        <div style={S.info}>
          <h2 style={S.name}>{displayName}</h2>
          <p style={S.username}>@{profile.username}</p>

          {/* Bio */}
          {isOwn ? (
            editing ? (
              <div style={S.bioEditWrap}>
                <textarea style={S.bioTextarea} value={bio}
                  onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Write something about yourself…" />
                <div style={S.bioActions}>
                  <button style={S.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
                  <button style={S.saveBtn} onClick={saveBio} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={S.bioRow}>
                <p style={S.bio}>{profile.bio || 'No bio yet.'}</p>
                <button style={S.editBioBtn} onClick={() => setEditing(true)}>Edit</button>
              </div>
            )
          ) : (
            profile.bio && <p style={S.bio}>{profile.bio}</p>
          )}

          {/* Actions (other user) */}
          {!isOwn && (
            <div style={S.actions}>
              <button
                style={friendBtnStyle()}
                onClick={handleFriendAction}
                disabled={profile.is_friend || profile.is_pending}
              >
                {friendBtnLabel()}
              </button>
              <button style={{ ...S.actionBtn, background: 'var(--bg-3)', color: 'var(--txt)' }} onClick={openDM}>
                Message
              </button>
            </div>
          )}
        </div>

        {/* Own profile quick actions */}
        {isOwn && (
          <div style={S.quickGrid}>
            <button style={S.quickCard} onClick={() => navigate('/friends')}>
              <span style={S.quickIcon}>🤝</span>
              <span style={S.quickLabel}>Friends</span>
            </button>
            <button style={S.quickCard} onClick={() => navigate('/chats')}>
              <span style={S.quickIcon}>💬</span>
              <span style={S.quickLabel}>Chats</span>
            </button>
            <button style={S.quickCard} onClick={() => navigate('/discover')}>
              <span style={S.quickIcon}>🔍</span>
              <span style={S.quickLabel}>Discover</span>
            </button>
            <button style={S.quickCard} onClick={() => navigate('/')}>
              <span style={S.quickIcon}>🎬</span>
              <span style={S.quickLabel}>Watch</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  page:    { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--txt-2)' },
  header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', flexShrink: 0 },
  backBtn: { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt)', borderRadius: 'var(--r-sm)' },
  headerTitle: { fontSize: '1rem', fontWeight: 700, color: 'var(--txt)' },
  title:   { fontSize: '1.4rem', fontWeight: 900, color: 'var(--txt)', letterSpacing: '-0.5px' },
  signOutBtn: { background: 'none', border: '1px solid var(--bg-4)', color: 'var(--txt-2)', padding: '6px 14px', borderRadius: 'var(--r-full)', fontSize: '0.82rem', cursor: 'pointer' },

  body:    { flex: 1, overflowY: 'auto' },
  cover:   { height: 120, position: 'relative', overflow: 'hidden' },
  coverGrad: { position: 'absolute', inset: 0, background: 'var(--grad)', opacity: 0.6 },
  avatarWrap: { marginTop: -44, paddingLeft: 20, marginBottom: 8 },

  info:    { padding: '0 20px 20px' },
  name:    { fontSize: '1.25rem', fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.3px', marginBottom: 2 },
  username:{ fontSize: '0.88rem', color: 'var(--txt-2)', marginBottom: 12 },
  bioRow:  { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  bio:     { fontSize: '0.9rem', color: 'var(--txt-2)', lineHeight: 1.6, flex: 1 },
  editBioBtn: { background: 'none', border: '1px solid var(--bg-4)', borderRadius: 'var(--r-sm)', color: 'var(--brand)', fontSize: '0.78rem', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', flexShrink: 0 },
  bioEditWrap:{ marginBottom: 16 },
  bioTextarea:{ width: '100%', padding: '10px 12px', background: 'var(--bg-3)', border: '1px solid var(--bg-4)', borderRadius: 'var(--r-md)', color: 'var(--txt)', fontSize: '0.9rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' },
  bioActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 },
  cancelBtn:  { padding: '7px 14px', background: 'var(--bg-3)', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.85rem', cursor: 'pointer' },
  saveBtn:    { padding: '7px 18px', background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' },
  actions: { display: 'flex', gap: 10, marginTop: 4 },
  actionBtn:  { flex: 1, padding: '11px 16px', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center' },

  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '0 20px 20px' },
  quickCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 8px', background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--r-lg)', cursor: 'pointer' },
  quickIcon: { fontSize: '1.5rem' },
  quickLabel:{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--txt-2)', textAlign: 'center' },
};
