import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Avatar from '../components/Avatar';

const SearchIc = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;

export default function Discover() {
  const [rooms,    setRooms]    = useState([]);
  const [users,    setUsers]    = useState([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('rooms'); // 'rooms' | 'people'
  const navigate = useNavigate();

  useEffect(() => { loadRooms(); }, []);

  async function loadRooms() {
    setLoading(true);
    try { setRooms(await api.social.discover()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function doSearch(q) {
    setSearch(q);
    if (!q.trim()) { setUsers([]); return; }
    try { setUsers(await api.social.searchUsers(q)); }
    catch { setUsers([]); }
  }

  async function joinRoom(code) {
    try { await api.rooms.join(code); navigate(`/room/${code}`); }
    catch { navigate(`/room/${code}`); }
  }

  const ROOM_COLORS = ['#7c3aed', '#db2777', '#0891b2', '#059669', '#d97706'];

  return (
    <div style={S.page}>
      <header style={S.header}>
        <h1 style={S.title}>Discover</h1>
      </header>

      {/* Search */}
      <div style={S.searchWrap}>
        <div style={S.searchBox}>
          <SearchIc />
          <input style={S.searchInput} placeholder="Search rooms or people…"
            value={search} onChange={(e) => doSearch(e.target.value)} />
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {['rooms', 'people'].map((t) => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}
            onClick={() => { setTab(t); if (t === 'people' && !search) doSearch(''); }}>
            {t === 'rooms' ? '🎬 Rooms' : '👥 People'}
          </button>
        ))}
      </div>

      <div style={S.content}>
        {/* People search results */}
        {tab === 'people' && (
          <div style={S.peopleGrid}>
            {users.length === 0 && (
              <p style={S.empty}>
                {search ? 'No users found.' : 'Type a username above to find people.'}
              </p>
            )}
            {users.map((u) => (
              <button key={u.id} style={S.personCard} onClick={() => navigate(`/profile/${u.id}`)}>
                <Avatar name={u.username} size={56} />
                <span style={S.personName}>{u.username}</span>
                {u.bio && <span style={S.personBio}>{u.bio}</span>}
                {u.is_friend && <span style={S.friendTag}>Friend</span>}
              </button>
            ))}
          </div>
        )}

        {/* Live rooms */}
        {tab === 'rooms' && (
          <>
            {loading && <p style={S.empty}>Loading live rooms…</p>}
            {!loading && rooms.length === 0 && (
              <div style={S.emptyState}>
                <span style={{ fontSize: '2.5rem' }}>📡</span>
                <p style={S.emptyTitle}>No live rooms</p>
                <p style={S.emptySub}>Create one and invite friends to start watching!</p>
                <button style={S.startBtn} onClick={() => navigate('/')}>Start a Room</button>
              </div>
            )}
            <div style={S.roomGrid}>
              {rooms.map((room, i) => {
                const color = ROOM_COLORS[i % ROOM_COLORS.length];
                return (
                  <div key={room.id} style={{ ...S.roomCard, '--accent': color }}>
                    <div style={{ ...S.roomThumb, background: `linear-gradient(135deg, ${color}22, ${color}44)` }}>
                      <span style={S.roomIcon}>🎬</span>
                      <div style={{ ...S.livePip, background: color }}>LIVE</div>
                    </div>
                    <div style={S.roomInfo}>
                      <p style={S.roomName}>{room.name || `${room.owner_username}'s room`}</p>
                      <div style={S.roomMeta}>
                        <Avatar name={room.owner_username} size={18} />
                        <span style={S.roomOwner}>{room.owner_username}</span>
                        <span style={S.roomDot}>·</span>
                        <span style={S.roomCount}>{room.member_count} watching</span>
                      </div>
                      <button style={{ ...S.joinBtn, background: color }} onClick={() => joinRoom(room.code)}>
                        Join Room
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page:     { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' },
  header:   { padding: '16px 16px 8px', flexShrink: 0 },
  title:    { fontSize: '1.4rem', fontWeight: 900, color: 'var(--txt)', letterSpacing: '-0.5px' },
  searchWrap:{ padding: '0 16px 10px', flexShrink: 0 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-3)', borderRadius: 'var(--r-full)', padding: '10px 16px' },
  searchInput:{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '0.92rem', color: 'var(--txt)' },
  tabs:     { display: 'flex', gap: 8, padding: '0 16px 12px', flexShrink: 0 },
  tab:      { padding: '7px 16px', background: 'var(--bg-3)', border: 'none', borderRadius: 'var(--r-full)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--txt-2)', cursor: 'pointer', transition: 'all var(--t)' },
  tabOn:    { background: 'var(--grad)', color: '#fff' },
  content:  { flex: 1, overflowY: 'auto', padding: '0 16px 16px' },

  peopleGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 },
  personCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 10px', background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--r-lg)', cursor: 'pointer', textAlign: 'center' },
  personName: { fontSize: '0.88rem', fontWeight: 700, color: 'var(--txt)' },
  personBio:  { fontSize: '0.75rem', color: 'var(--txt-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' },
  friendTag:  { fontSize: '0.68rem', fontWeight: 700, color: 'var(--brand)', background: 'rgba(124,58,237,0.1)', borderRadius: 'var(--r-full)', padding: '2px 8px' },

  roomGrid:   { display: 'flex', flexDirection: 'column', gap: 12 },
  roomCard:   { background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--r-lg)', overflow: 'hidden' },
  roomThumb:  { height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  roomIcon:   { fontSize: '3rem' },
  livePip:    { position: 'absolute', top: 8, left: 8, color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--r-full)', letterSpacing: '0.08em' },
  roomInfo:   { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 },
  roomName:   { fontSize: '0.97rem', fontWeight: 700, color: 'var(--txt)' },
  roomMeta:   { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--txt-2)' },
  roomOwner:  { fontWeight: 600 },
  roomDot:    { color: 'var(--txt-3)' },
  roomCount:  {},
  joinBtn:    { padding: '9px 0', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: '0.87rem', cursor: 'pointer', width: '100%' },

  empty:      { textAlign: 'center', color: 'var(--txt-2)', fontSize: '0.87rem', padding: '24px 0' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '48px 24px', textAlign: 'center' },
  emptyTitle: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--txt)' },
  emptySub:   { fontSize: '0.85rem', color: 'var(--txt-2)', lineHeight: 1.55 },
  startBtn:   { marginTop: 4, padding: '11px 24px', background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' },
};
