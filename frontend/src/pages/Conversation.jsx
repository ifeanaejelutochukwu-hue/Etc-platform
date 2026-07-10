import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { onMessage, connectWebSocket } from '../services/ws';
import { useAuthStore } from '../stores/auth';
import Avatar from '../components/Avatar';

const Back  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const Send  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const Watch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
const Call  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.64 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.08 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L9.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;

export default function Conversation() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);
  const [conv,    setConv]    = useState(null);
  const [msgs,    setMsgs]    = useState([]);
  const [input,   setInput]   = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    load();
    const unsub = onMessage('dm.message', (msg) => {
      if (msg.conversation_id === id)
        setMsgs((prev) => [...prev, msg]);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function load() {
    try {
      const [convData, msgData] = await Promise.all([
        api.dm.getConversation(id),
        api.dm.getMessages(id),
      ]);
      setConv(convData);
      setMsgs(msgData);
    } catch { /* ignore */ }
  }

  async function send(msgType = 'text', content = input.trim()) {
    if (!content) return;
    setSending(true);
    try {
      const msg = await api.dm.sendMessage(id, content, msgType);
      setMsgs((prev) => [...prev, msg]);
      setInput('');
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  async function startWatchParty() {
    try {
      const { code } = await api.rooms.create({ name: `${user?.username}'s party`, type: 'watch' });
      // Send invite message then navigate
      await send('watch_invite', `Join my watch party! Code: ${code}`);
      navigate(`/room/${code}`);
    } catch { /* ignore */ }
  }

  function convName() {
    if (!conv) return '…';
    if (conv.type === 'group') return conv.name || 'Group';
    const other = conv.members?.find((m) => m.user_id !== user?.id);
    return other?.username || 'Chat';
  }

  function convAvatar() {
    if (!conv) return '?';
    if (conv.type === 'group') return conv.name || 'G';
    const other = conv.members?.find((m) => m.user_id !== user?.id);
    return other?.username || '?';
  }

  function otherUserID() {
    return conv?.members?.find((m) => m.user_id !== user?.id)?.user_id;
  }

  // Group messages by date
  const grouped = groupByDate(msgs);

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <button style={S.iconBtn} onClick={() => navigate('/chats')}><Back /></button>
        <button style={S.profileBtn} onClick={() => otherUserID() && navigate(`/profile/${otherUserID()}`)}>
          <Avatar name={convAvatar()} size={36} />
          <div style={S.headerMeta}>
            <span style={S.headerName}>{convName()}</span>
            {conv?.type === 'direct' && <span style={S.headerSub}>tap to view profile</span>}
            {conv?.type === 'group'  && <span style={S.headerSub}>{conv.members?.length} members</span>}
          </div>
        </button>
        <div style={S.headerActions}>
          <button style={S.iconBtn} onClick={startWatchParty} title="Start watch party"><Watch /></button>
          <button style={S.iconBtn} title="Voice call"><Call /></button>
        </div>
      </header>

      {/* Messages */}
      <div style={S.feed}>
        {grouped.map(({ date, messages }) => (
          <div key={date}>
            <div style={S.dateBadge}>{date}</div>
            {messages.map((m) => {
              const own = m.sender_id === user?.id;
              const isInvite = m.msg_type === 'watch_invite';
              return (
                <div key={m.id} style={{ ...S.msgRow, ...(own ? S.msgRowOwn : {}) }}>
                  {!own && <Avatar name={m.sender_username} size={28} style={{ flexShrink: 0, marginTop: 2 }} />}
                  <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: own ? 'flex-end' : 'flex-start' }}>
                    {!own && conv?.type === 'group' && (
                      <span style={S.senderName}>{m.sender_username}</span>
                    )}
                    {isInvite ? (
                      <WatchInviteBubble msg={m} own={own} navigate={navigate} />
                    ) : (
                      <div style={{ ...S.bubble, ...(own ? S.bubbleOut : S.bubbleIn) }}>
                        <span style={{ ...S.bubbleTxt, ...(own ? S.bubbleTxtOut : {}) }}>{m.content}</span>
                      </div>
                    )}
                    <span style={S.time}>{formatTime(m.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {msgs.length === 0 && (
          <div style={S.emptyState}>
            <span style={{ fontSize: '2rem' }}>👋</span>
            <p style={{ color: 'var(--txt-2)', fontSize: '0.9rem' }}>Say hello!</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div style={S.inputBar}>
        <button style={S.watchBtn} onClick={startWatchParty} title="Start watch party">🎬</button>
        <input
          style={S.input}
          placeholder="Message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button
          style={{ ...S.sendBtn, ...((!input.trim() || sending) ? S.sendBtnDim : {}) }}
          onClick={() => send()}
          disabled={!input.trim() || sending}
        >
          <Send />
        </button>
      </div>
    </div>
  );
}

function WatchInviteBubble({ msg, own, navigate }) {
  const match = msg.content.match(/Code:\s*([A-Z0-9]{6})/);
  const code = match?.[1];
  return (
    <div style={S.inviteBubble}>
      <div style={S.inviteTop}>
        <span style={{ fontSize: '1.4rem' }}>🎬</span>
        <div>
          <p style={S.inviteTitle}>Watch Party Invite</p>
          {code && <p style={S.inviteCode}>Code: {code}</p>}
        </div>
      </div>
      {code && (
        <button style={S.inviteJoinBtn} onClick={() => navigate(`/room/${code}`)}>
          Join Room →
        </button>
      )}
    </div>
  );
}

function groupByDate(msgs) {
  const map = {};
  const order = [];
  msgs.forEach((m) => {
    const d = new Date(m.created_at);
    const key = isToday(d) ? 'Today' : isYesterday(d)
      ? 'Yesterday'
      : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    if (!map[key]) { map[key] = []; order.push(key); }
    map[key].push(m);
  });
  return order.map((date) => ({ date, messages: map[date] }));
}
function isToday(d) { const n = new Date(); return d.toDateString() === n.toDateString(); }
function isYesterday(d) { const y = new Date(); y.setDate(y.getDate()-1); return d.toDateString() === y.toDateString(); }
function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const S = {
  page:    { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' },
  header:  { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--bg-3)', flexShrink: 0, background: 'var(--bg)' },
  iconBtn: { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt)', borderRadius: 'var(--r-sm)' },
  profileBtn: { flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' },
  headerMeta: { display: 'flex', flexDirection: 'column', gap: 1 },
  headerName: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--txt)' },
  headerSub:  { fontSize: '0.72rem', color: 'var(--txt-2)' },
  headerActions: { display: 'flex', gap: 2 },

  feed:    { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 },
  dateBadge: { textAlign: 'center', fontSize: '0.72rem', color: 'var(--txt-2)', background: 'var(--bg-3)', borderRadius: 'var(--r-full)', padding: '3px 12px', margin: '8px auto', width: 'fit-content' },
  msgRow:  { display: 'flex', alignItems: 'flex-start', gap: 8 },
  msgRowOwn: { flexDirection: 'row-reverse' },
  senderName: { fontSize: '0.7rem', fontWeight: 600, color: 'var(--brand)', marginLeft: 2 },
  bubble:  { padding: '9px 13px', borderRadius: 'var(--r-lg)', lineHeight: 1.45 },
  bubbleIn:  { background: 'var(--bg-3)', borderBottomLeftRadius: 'var(--r-xs)' },
  bubbleOut: { background: 'var(--brand)', borderBottomRightRadius: 'var(--r-xs)' },
  bubbleTxt: { fontSize: '0.9rem', color: 'var(--txt)', wordBreak: 'break-word' },
  bubbleTxtOut: { color: '#fff' },
  time:    { fontSize: '0.65rem', color: 'var(--txt-3)' },

  // Watch invite bubble
  inviteBubble: { background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--r-lg)', padding: '12px 14px', minWidth: 200, maxWidth: 260 },
  inviteTop:    { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  inviteTitle:  { fontSize: '0.88rem', fontWeight: 700, color: 'var(--txt)' },
  inviteCode:   { fontSize: '0.75rem', color: 'var(--txt-2)', fontFamily: 'monospace', letterSpacing: '0.1em' },
  inviteJoinBtn:{ width: '100%', padding: '9px', background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' },

  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 },

  inputBar:  { display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--bg-3)', flexShrink: 0, background: 'var(--bg)', paddingBottom: 'calc(8px + var(--sab))' },
  watchBtn:  { width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-3)', border: 'none', fontSize: '1.1rem', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  input:     { flex: 1, padding: '10px 16px', background: 'var(--bg-3)', border: 'none', borderRadius: 'var(--r-full)', color: 'var(--txt)', fontSize: '0.9rem', outline: 'none' },
  sendBtn:   { width: 40, height: 40, borderRadius: '50%', background: 'var(--grad)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(124,58,237,0.3)' },
  sendBtnDim:{ background: 'var(--bg-4)', boxShadow: 'none' },
};
