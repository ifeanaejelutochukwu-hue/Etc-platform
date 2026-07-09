import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api } from '../services/api';

export default function Dashboard() {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  async function createRoom() {
    try {
      const { room, code } = await api.rooms.create({ type: 'watch' });
      navigate(`/room/${code}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function joinRoom() {
    if (!roomCode.trim()) return;
    try {
      await api.rooms.join(roomCode.toUpperCase());
      navigate(`/room/${roomCode.toUpperCase()}`);
    } catch (err) {
      setError(err.message);
    }
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f0f23', fontFamily: 'system-ui, sans-serif', color: '#fff' },
    card: { background: '#1a1a3e', padding: '2.5rem', borderRadius: '16px', width: '420px', boxShadow: '0 0 40px rgba(0,0,0,0.5)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
    logo: { fontSize: '1.5rem', fontWeight: 700, color: '#6c63ff' },
    logout: { background: 'transparent', border: '1px solid #666', color: '#888', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' },
    username: { color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' },
    btn: { width: '100%', padding: '14px', borderRadius: '10px', border: 'none', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', marginBottom: '12px' },
    primary: { background: '#6c63ff', color: '#fff' },
    secondary: { background: '#2a2a5a', color: '#fff', border: '1px solid #444' },
    input: { width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #333', background: '#2a2a5a', color: '#fff', fontSize: '1rem', boxSizing: 'border-box', marginBottom: '12px', outline: 'none', textAlign: 'center', letterSpacing: '4px', textTransform: 'uppercase' },
    divider: { textAlign: 'center', color: '#555', margin: '16px 0', fontSize: '0.85rem' },
    error: { color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '12px', textAlign: 'center' },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.logo}>ETC</span>
          <button style={styles.logout} onClick={() => { clearAuth(); navigate('/login'); }}>Log out</button>
        </div>
        <div style={styles.username}>Hey, {user?.username || 'there'}</div>
        {error && <div style={styles.error}>{error}</div>}
        <button style={{ ...styles.btn, ...styles.primary }} onClick={createRoom}>
          Create a Room
        </button>
        <div style={styles.divider}>— or join one —</div>
        <input
          style={styles.input}
          placeholder="ROOM CODE"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button style={{ ...styles.btn, ...styles.secondary }} onClick={joinRoom}>
          Join Room
        </button>
      </div>
    </div>
  );
}
