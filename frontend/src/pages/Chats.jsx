import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { onMessage, connectWebSocket } from '../services/ws';
import { useAuthStore } from '../stores/auth';
import Avatar from '../components/Avatar';

export default function Chats() {
  const [convs,   setConvs]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    connectWebSocket();
    load();
    // Real-time: new DM arrives → bump conversation to top
    const unsub = onMessage('dm.message', (msg) => {
      setConvs((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversation_id);
        if (idx === -1) { load(); return prev; }
        const updated = { ...prev[idx], last_message: msg };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    });
    return () => unsub();
  }, []);

  async function load() {
    setLoading(true);
    try { setConvs(await api.dm.listConversations()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function doSearch(q) {
    setSearch(q);
    if (!q.trim()) { setResults([]); return; }
    try { setResults(await api.social.searchUsers(q)); }
    catch { setResults([]); }
  }

  async function openDM(uid) {
    try {
      const conv = await api.dm.getOrCreateDirect(uid);
      navigate(`/conversation/${conv.id}`);
    } catch { /* ignore */ }
  }

  function convName(conv) {
    if (conv.type === 'group') return conv.name || 'Group';
    const other = conv.members?.find((m) => m.user_id !== user?.id);
    return other?.username || conv.name || 'Chat';
  }

  function convAvatar(conv) {
    if (conv.type === 'group') return conv.name || 'G';
    const other = conv.members?.find((m) => m.user_id !== user?.id);
    return other?.username || '?';
  }

  const filtered = convs.filter((c) =>
    !search.trim() || convName(c).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={S.page}>
      <header style={S.header}>
        <h1 style={S.title}>Chats</h1>
        <button style={S.newBtn} onClick={() => navigate('/friends')} title="New chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </header>

      {/* Search bar */}
      <div style={S.searchWrap}>
        <input style={S.searchInput} placeholder="Search or start new chat"
          value={search} onChange={(e) => doSearch(e.target.value)} />
      </div>

      {/* User search results */}
      {results.length > 0 && (
        <div style={S.section}>
          <p style={S.sectionLabel}>People</p>
          {results.map((u) => (
            <button key={u.id} style={S.row} onClick={() => openDM(u.id)}>
              <Avatar name={u.username} size={42} />
              <div style={S.rowMeta}>
                <span style={S.rowName}>{u.username}</span>
                {u.bio && <span style={S.rowSub}>{u.bio}</span>}
              </div>
              {u.is_friend && <span style={S.friendBadge}>Friend</span>}
            </button>
          ))}
        </div>
      )}

      {/* Conversation list */}
      <div style={S.list}>
        {loading && <p style={S.empty}>Loading…</p>}
        {!loading && filtered.length === 0 && (
          <div style={S.emptyState}>
            <span style={{ fontSize: '2.5rem' }}>💬</span>
            <p style={S.emptyTitle}>No chats yet</p>
            <p style={S.emptySub}>Search for someone above to start a conversation.</p>
          </div>
        )}
        {filtered.map((conv) => {
          const last = conv.last_message;
          const name = convName(conv);
          const avatarName = convAvatar(conv);
          const isOwn = last?.sender_id === user?.id;
          return (
            <button key={conv.id} style={S.row} onClick={() => navigate(`/conversation/${conv.id}`)}>
              <div style={{ position: 'relative' }}>
                <Avatar name={avatarName} size={46} />
                {conv.type === 'group' && (
                  <span style={S.groupDot}>👥</span>
                )}
              </div>
              <div style={S.rowMeta}>
                <div style={S.rowTop}>
                  <span style={S.rowName}>{name}</span>
                  {last && (
                    <span style={S.rowTime}>{formatTime(last.created_at)}</span>
                  )}
                </div>
                <span style={S.rowSub}>
                  {last
                    ? `${isOwn ? 'You: ' : ''}${last.msg_type === 'watch_invite' ? '🎬 Watch party invite' : last.content}`
                    : 'No messages yet'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const S = {
  page:    { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' },
  header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 8px', flexShrink: 0 },
  title:   { fontSize: '1.4rem', fontWeight: 900, color: 'var(--txt)', letterSpacing: '-0.5px' },
  newBtn:  { width: 36, height: 36, borderRadius: '50%', background: 'var(--grad)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  searchWrap: { padding: '0 16px 10px', flexShrink: 0 },
  searchInput:{ width: '100%', padding: '10px 16px', background: 'var(--bg-3)', border: 'none', borderRadius: 'var(--r-full)', fontSize: '0.92rem', color: 'var(--txt)', outline: 'none' },
  section: { padding: '0 8px 6px', flexShrink: 0 },
  sectionLabel: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--txt-2)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 8px 6px' },
  list:    { flex: 1, overflowY: 'auto' },
  row:     { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background var(--t)' },
  rowMeta: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  rowTop:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowTime: { fontSize: '0.72rem', color: 'var(--txt-2)', flexShrink: 0, marginLeft: 6 },
  rowSub:  { fontSize: '0.83rem', color: 'var(--txt-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  friendBadge: { fontSize: '0.68rem', fontWeight: 700, color: 'var(--brand)', background: 'rgba(124,58,237,0.1)', borderRadius: 'var(--r-full)', padding: '2px 8px', flexShrink: 0 },
  groupDot:    { position: 'absolute', bottom: -2, right: -2, fontSize: '0.7rem' },
  empty:       { textAlign: 'center', color: 'var(--txt-2)', padding: 24, fontSize: '0.87rem' },
  emptyState:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 8, textAlign: 'center' },
  emptyTitle:  { fontSize: '1rem', fontWeight: 700, color: 'var(--txt)' },
  emptySub:    { fontSize: '0.85rem', color: 'var(--txt-2)', lineHeight: 1.55 },
};
