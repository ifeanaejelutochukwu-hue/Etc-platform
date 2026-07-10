import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Room         from './pages/Room';
import Chats        from './pages/Chats';
import Conversation from './pages/Conversation';
import Discover     from './pages/Discover';
import Friends      from './pages/Friends';
import Profile      from './pages/Profile';

/* Pages that show the bottom tab bar */
const TABBED = ['/', '/chats', '/discover', '/friends', '/profile'];

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function BottomNav() {
  const location = useLocation();
  const navigate  = useNavigate();
  const token     = useAuthStore((s) => s.token);

  const path = location.pathname;
  const show = token && TABBED.some((t) => path === t || (t !== '/' && path.startsWith(t)));
  if (!show) return null;

  const tabs = [
    { path: '/chats',    label: 'Chats',    icon: ChatIc    },
    { path: '/discover', label: 'Discover', icon: CompassIc },
    { path: '/',         label: 'Watch',    icon: PlayIc    },
    { path: '/friends',  label: 'Friends',  icon: UsersIc   },
    { path: '/profile',  label: 'Profile',  icon: PersonIc  },
  ];

  return (
    <nav style={NAV.bar}>
      {tabs.map((t) => {
        const active = t.path === '/' ? path === '/' : path.startsWith(t.path);
        return (
          <button key={t.path} style={NAV.btn} onClick={() => navigate(t.path)}>
            <span style={{ color: active ? 'var(--brand)' : 'var(--txt-2)' }}>
              <t.icon active={active} />
            </span>
            <span style={{ ...NAV.label, color: active ? 'var(--brand)' : 'var(--txt-2)' }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const path = location.pathname;
  const isRoom = path.startsWith('/room/') || path.startsWith('/conversation/');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: 600, margin: '0 auto', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/"           element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/room/:code" element={<ProtectedRoute><Room /></ProtectedRoute>} />
          <Route path="/chats"      element={<ProtectedRoute><Chats /></ProtectedRoute>} />
          <Route path="/conversation/:id" element={<ProtectedRoute><Conversation /></ProtectedRoute>} />
          <Route path="/discover"   element={<ProtectedRoute><Discover /></ProtectedRoute>} />
          <Route path="/friends"    element={<ProtectedRoute><Friends /></ProtectedRoute>} />
          <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isRoom && <BottomNav />}
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────────────── */
const ChatIc    = ({ active }) => <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'var(--brand)' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const CompassIc = ({ active }) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={active ? 'var(--brand)' : 'none'} stroke="currentColor"/></svg>;
const PlayIc    = ({ active }) => <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'var(--brand)' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><polygon points="10 8 16 12 10 16 10 8" fill={active ? '#fff' : 'currentColor'} stroke="none"/></svg>;
const UsersIc   = ({ active }) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4" fill={active ? 'var(--brand)' : 'none'}/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const PersonIc  = ({ active }) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4" fill={active ? 'var(--brand)' : 'none'}/></svg>;

const NAV = {
  bar:   { display: 'flex', height: 56, borderTop: '1px solid var(--bg-3)', background: 'var(--bg)', paddingBottom: 'var(--sab)', flexShrink: 0 },
  btn:   { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' },
  label: { fontSize: '0.63rem', fontWeight: 600 },
};
