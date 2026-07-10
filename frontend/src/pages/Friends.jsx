import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { onMessage, connectWebSocket } from '../services/ws';
import Avatar from '../components/Avatar';

export default function Friends() {
  const [friends,  setFriends]  = useState([]);
  const [pending,  setPending]  = useState([]);
  const [search,   setSearch]   = useState('');
  const [results,  setResults]  = useState([]);
  const [tab,      setTab]      = useState('friends'); // 'friends' | 'requests' | 'search'
  const [loading,  setLoading]  = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    connectWebSocket();
    load();
    // Real-time friend request notification
    const unsub = onMessage('friend.request', () => load());
    return () => unsub();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [f, p] = await Promise.all([api.social.listFriends(), api.social.listPending()]);
      setFriends(f); setPending(p);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function doSearch(q) {
    setSearch(q);
    if (!q.trim()) { setResults([]); return; }
    try { setResults(await api.social.searchUsers(q)); }
    catch { setResults([]); }
  }

  async function sendReq(id) {
    try {
      await api.social.sendRequest(id);
      setResults((prev) => prev.map((u) => u.id === id ? { ...u, is_pending: true } : u));
    } catch { /* ignore */ }
  }

  async function accept(requesterId) {
    try {
      await api.social.acceptRequest(requesterId);
      load();
    } catch { /* ignore */ }
  }

  async function decline(requesterId) {
    try {
      await api.social.declineRequest(requesterId);
      setPending((prev) => prev.filter((r) => r.user.id !== requesterId));
    } catch { /* ignore */ }
  }

  async function openDM(uid) {
    try {
      const conv = await api.dm.getOrCreateDirect(uid);
      navigate(`/conversation/${conv.id}`);
    } catch { /* ignore */ }
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <h1 style={S.title}>Friends</h1>
      </header>

      {/* Search bar */}
      <div style={S.searchWrap}>
        <input style={S.searchInput} placeholder="Find people by username"
          value={search}
          onChange={(e) => { doSearch(e.target.value); setTab('search'); }}
          onFocus={() => setTab('search')}
        />
      </div>

      {/* Tab bar */}
      <div style={S.tabs}>
        {[
          { id: 'friends',  label: `Friends ${friends.length ? `(${friends.length})` : ''}` },
          { id: 'requests', label: `Requests ${pending.length ? `(${pending.length})` : ''}`, badge: pending.length },
          { id: 'search',   label: 'Add New' },
        ].map((t) => (
          <button key={t.id} style={{ ...S.tab, ...(tab === t.id ? S.tabOn : {}) }} onClick={() => setTab(t.id)}>
            {t.label}
            {t.badge > 0 && tab !== t.id && <span style={S.badge}>{t.badge}</span>}
          </button>
        ))}
      </div>

      <div style={S.content}>
        {/* Friends list */}
        {tab === 'friends' && (
          <>
            {loading && <p style={S.empty}>Loading…</p>}
            {!loading && friends.length === 0 && (
              <div style={S.emptyState}>
                <span style={{ fontSize: '2rem' }}>🤝</span>
                <p style={S.emptyTitle}>No friends yet</p>
                <p style={S.emptySub}>Search for people and send them a friend request.</p>
              </div>
            )}
            {friends.map((u) => (
              <div key={u.id} style={S.row}>
                <button style={S.avatarBtn} onClick={() => navigate(`/profile/${u.id}`)}>
                  <Avatar name={u.username} size={44} />
                </button>
                <div style={S.rowMeta}>
                  <span style={S.rowName}>{u.username}</span>
                  {u.bio && <span style={S.rowSub}>{u.bio}</span>}
                </div>
                <div style={S.rowActions}>
                  <button style={S.dmBtn} onClick={() => openDM(u.id)}>Message</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Incoming requests */}
        {tab === 'requests' && (
          <>
            {pending.length === 0 && <p style={S.empty}>No pending requests.</p>}
            {pending.map((req) => (
              <div key={req.id} style={S.row}>
                <button style={S.avatarBtn} onClick={() => navigate(`/profile/${req.user.id}`)}>
                  <Avatar name={req.user.username} size={44} />
                </button>
                <div style={S.rowMeta}>
                  <span style={S.rowName}>{req.user.username}</span>
                  <span style={S.rowSub}>wants to connect</span>
                </div>
                <div style={S.rowActions}>
                  <button style={S.acceptBtn} onClick={() => accept(req.user.id)}>Accept</button>
                  <button style={S.declineBtn} onClick={() => decline(req.user.id)}>✕</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Add new / search */}
        {tab === 'search' && (
          <>
            {results.length === 0 && search.trim() && <p style={S.empty}>No users found.</p>}
            {results.length === 0 && !search.trim() && (
              <p style={S.empty}>Start typing to find people.</p>
            )}
            {results.map((u) => (
              <div key={u.id} style={S.row}>
                <button style={S.avatarBtn} onClick={() => navigate(`/profile/${u.id}`)}>
                  <Avatar name={u.username} size={44} />
                </button>
                <div style={S.rowMeta}>
                  <span style={S.rowName}>{u.username}</span>
                  {u.bio && <span style={S.rowSub}>{u.bio}</span>}
                </div>
                <div style={S.rowActions}>
                  {u.is_friend    && <span style={S.tag}>Friend</span>}
                  {u.is_pending   && <span style={S.tag}>Sent</span>}
                  {u.is_incoming  && (
                    <button style={S.acceptBtn} onClick={() => accept(u.id)}>Accept</button>
                  )}
                  {!u.is_friend && !u.is_pending && !u.is_incoming && (
                    <button style={S.addBtn} onClick={() => sendReq(u.id)}>Add</button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page:    { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' },
  header:  { padding: '16px 16px 8px', flexShrink: 0 },
  title:   { fontSize: '1.4rem', fontWeight: 900, color: 'var(--txt)', letterSpacing: '-0.5px' },
  searchWrap:  { padding: '0 16px 10px', flexShrink: 0 },
  searchInput: { width: '100%', padding: '10px 16px', background: 'var(--bg-3)', border: 'none', borderRadius: 'var(--r-full)', fontSize: '0.92rem', color: 'var(--txt)', outline: 'none' },
  tabs:  { display: 'flex', borderBottom: '1px solid var(--bg-3)', flexShrink: 0, padding: '0 16px' },
  tab:   { flex: 1, padding: '10px 4px', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: 'var(--txt-2)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', position: 'relative', marginBottom: -1, transition: 'color var(--t)' },
  tabOn: { color: 'var(--brand)', borderBottomColor: 'var(--brand)' },
  badge: { position: 'absolute', top: 6, right: 8, background: 'var(--red)', color: '#fff', borderRadius: 'var(--r-full)', fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', minWidth: 14, textAlign: 'center' },
  content: { flex: 1, overflowY: 'auto', padding: '8px 16px 16px' },
  row:      { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--bg-3)' },
  avatarBtn:{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 },
  rowMeta:  { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  rowName:  { fontSize: '0.93rem', fontWeight: 700, color: 'var(--txt)' },
  rowSub:   { fontSize: '0.8rem', color: 'var(--txt-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowActions:{ display: 'flex', gap: 6, flexShrink: 0 },
  dmBtn:    { padding: '7px 14px', background: 'var(--bg-3)', border: 'none', borderRadius: 'var(--r-full)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--txt)', cursor: 'pointer' },
  addBtn:   { padding: '7px 14px', background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-full)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' },
  acceptBtn:{ padding: '7px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--r-full)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' },
  declineBtn:{ padding: '7px 10px', background: 'var(--bg-3)', border: 'none', borderRadius: 'var(--r-full)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--txt-2)', cursor: 'pointer' },
  tag:      { fontSize: '0.75rem', fontWeight: 600, color: 'var(--txt-2)', padding: '5px 10px', background: 'var(--bg-3)', borderRadius: 'var(--r-full)' },
  empty:    { textAlign: 'center', color: 'var(--txt-2)', fontSize: '0.87rem', padding: '24px 0' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '48px 24px', textAlign: 'center' },
  emptyTitle: { fontSize: '1rem', fontWeight: 700, color: 'var(--txt)' },
  emptySub:   { fontSize: '0.85rem', color: 'var(--txt-2)', lineHeight: 1.55 },
};
