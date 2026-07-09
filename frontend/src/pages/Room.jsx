import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api } from '../services/api';
import { connectWebSocket, sendMessage, onMessage, disconnectWebSocket } from '../services/ws';

import { Room as LKRoom, ConnectionState } from 'livekit-client';

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mediaSource, setMediaSource] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [liveKitToken, setLiveKitToken] = useState(null);
  const [remoteTracks, setRemoteTracks] = useState({});
  const [playlist, setPlaylist] = useState([]);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [queueInput, setQueueInput] = useState('');

  const playerRef = useRef(null);
  const chatEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const lkRoomRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    connectWebSocket();

    const unsub1 = onMessage('room.joined', (payload) => {
      setParticipants(payload.participants || []);
      if (payload.livekit_token) setLiveKitToken(payload.livekit_token);
    });
    const unsub2 = onMessage('room.participant_joined', (payload) => {
      setParticipants((prev) => [...prev, payload]);
    });
    const unsub3 = onMessage('room.participant_left', (payload) => {
      setParticipants((prev) => prev.filter((p) => p.user_id !== payload.user_id));
    });
    const unsub4 = onMessage('chat.message', (payload) => {
      setMessages((prev) => [...prev, {
        id: Date.now(),
        user_id: payload.user_id,
        username: payload.username || 'User',
        content: typeof payload.payload === 'string' ? payload.payload : JSON.stringify(payload.payload),
        timestamp: Date.now(),
      }]);
    });
    const unsub5 = onMessage('media.play', (payload) => {
      setIsPlaying(true);
      if (playerRef.current) {
        playerRef.current.currentTime = payload.current_time || 0;
        playerRef.current.play().catch(() => {});
      }
    });
    const unsub6 = onMessage('media.pause', (payload) => {
      setIsPlaying(false);
      if (playerRef.current) {
        playerRef.current.currentTime = payload.current_time || 0;
        playerRef.current.pause();
      }
    });
    const unsub7 = onMessage('media.seek', (payload) => {
      if (playerRef.current) {
        playerRef.current.currentTime = payload.current_time || 0;
      }
    });
    const unsub8 = onMessage('media.changed', (payload) => {
      setMediaSource(payload);
      setIsPlaying(false);
    });
    const unsub9 = onMessage('playlist.updated', (payload) => {
      setPlaylist(payload.items || []);
    });
    const unsub10 = onMessage('playlist.now_playing', (payload) => {
      setNowPlaying(payload.item);
      setMediaSource({ source_type: payload.item?.source_type, source_url: payload.item?.source_url, title: payload.item?.title });
      setIsPlaying(true);
    });

    sendMessage('room.join', { room_code: code });

    return () => {
      sendMessage('room.leave', {});
      disconnectWebSocket();
      unsub1(); unsub2(); unsub3(); unsub4();
      unsub5(); unsub6(); unsub7(); unsub8();
      unsub9(); unsub10();
      leaveCallInternal();
    };
  }, [code]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleVideoUrl = useCallback(() => {
    const match = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
      const ytId = match[1];
      setMediaSource({ source_type: 'youtube', source_url: ytId, title: videoUrl });
      sendMessage('media.change', { source_type: 'youtube', source_url: ytId, title: videoUrl });
    } else {
      setMediaSource({ source_type: 'direct_url', source_url: videoUrl, title: videoUrl });
      sendMessage('media.change', { source_type: 'direct_url', source_url: videoUrl, title: videoUrl });
    }
  }, [videoUrl]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
      sendMessage('media.pause', { current_time: playerRef.current.currentTime });
    } else {
      playerRef.current.play().catch(() => {});
      sendMessage('media.play', { current_time: playerRef.current.currentTime });
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const queueVideo = useCallback(() => {
    const match = queueInput.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
      sendMessage('playlist.add', { source_type: 'youtube', source_url: match[1], title: queueInput, duration: 0 });
    } else if (queueInput) {
      sendMessage('playlist.add', { source_type: 'direct_url', source_url: queueInput, title: queueInput, duration: 0 });
    }
    setQueueInput('');
  }, [queueInput]);

  const sendChat = useCallback(() => {
    if (!msgInput.trim()) return;
    sendMessage('chat.send', { message_type: 'text', content: msgInput });
    setMessages((prev) => [...prev, {
      id: Date.now(),
      user_id: user?.id,
      username: user?.username || 'You',
      content: msgInput,
      timestamp: Date.now(),
    }]);
    setMsgInput('');
  }, [msgInput, user]);

  async function joinCallInternal() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCallActive(true);

      if (liveKitToken) {
        const lkRoom = new LKRoom();
        lkRoom.on('participantConnected', (p) => {
          p.on('trackSubscribed', (track) => {
            setRemoteTracks((prev) => ({ ...prev, [p.identity]: track }));
          });
        });
        lkRoom.on('participantDisconnected', (p) => {
          setRemoteTracks((prev) => { const n = { ...prev }; delete n[p.identity]; return n; });
        });
        await lkRoom.connect('ws://localhost:7880', liveKitToken);
        await lkRoom.localParticipant.enableCameraAndMicrophone();
        lkRoomRef.current = lkRoom;
      }
    } catch (err) {
      console.error('join call failed:', err);
    }
  }

  function leaveCallInternal() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (lkRoomRef.current) {
      lkRoomRef.current.disconnect();
      lkRoomRef.current = null;
    }
    setCallActive(false);
    setRemoteTracks({});
  }

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    }
    setIsMuted(!isMuted);
    sendMessage('call.mute', { is_muted: !isMuted });
  }, [isMuted]);

  const toggleCamera = useCallback(async () => {
    if (cameraOn && localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      setCameraOn(false);
    } else if (localStreamRef.current) {
      try {
        const vidStream = await navigator.mediaDevices.getUserMedia({ video: true });
        vidStream.getVideoTracks().forEach((t) => localStreamRef.current.addTrack(t));
        setCameraOn(true);
      } catch (err) {
        console.error('camera failed:', err);
      }
    }
  }, [cameraOn]);

  const styles = {
    container: { display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#0f0f23', color: '#fff' },
    main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#1a1a3e', borderBottom: '1px solid #2a2a5a' },
    badge: { background: '#6c63ff', padding: '4px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 },
    callBtn: { background: '#22c55e', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
    callBtnActive: { background: '#ef4444' },
    videoArea: { flex: 1, display: 'flex', flexDirection: 'column', background: '#000', position: 'relative' },
    playerWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' },
    emptyPlayer: { color: '#555', fontSize: '1.1rem' },
    videoInput: { display: 'flex', padding: '12px 20px', gap: '8px', background: '#1a1a3e', borderTop: '1px solid #2a2a5a' },
    urlInput: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#2a2a5a', color: '#fff', fontSize: '0.9rem', outline: 'none' },
    loadBtn: { padding: '10px 20px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 },
    controls: { display: 'flex', gap: '8px', padding: '8px 20px', justifyContent: 'center', background: '#111' },
    ctrlBtn: { background: '#2a2a5a', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' },
    sidebar: { width: '320px', background: '#1a1a3e', borderLeft: '1px solid #2a2a5a', display: 'flex', flexDirection: 'column', flexShrink: 0 },
    sidebarSection: { padding: '16px', borderBottom: '1px solid #2a2a5a' },
    sectionTitle: { fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: '#888', marginBottom: '8px' },
    userItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '0.9rem' },
    avatar: { width: '36px', height: '36px', borderRadius: '50%', background: '#6c63ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600 },
    chatArea: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
    chatMsg: { fontSize: '0.85rem' },
    chatUser: { fontWeight: 600, color: '#6c63ff', marginRight: '8px' },
    ownMsg: { color: '#22c55e' },
    chatInput: { display: 'flex', padding: '12px', borderTop: '1px solid #2a2a5a', gap: '8px' },
    chatField: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#2a2a5a', color: '#fff', fontSize: '0.9rem', outline: 'none' },
    sendBtn: { padding: '10px 16px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 },
    leaveBtn: { background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' },
    callOverlay: { position: 'fixed', bottom: '80px', right: '340px', background: '#1a1a3e', borderRadius: '12px', padding: '16px', boxShadow: '0 0 30px rgba(0,0,0,0.7)', minWidth: '300px', zIndex: 100 },
    callHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    callGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '200px', overflowY: 'auto' },
    callParticipant: { textAlign: 'center', fontSize: '0.8rem', width: '80px' },
    speaking: { boxShadow: '0 0 0 2px #22c55e', borderRadius: '50%' },
    queueBtn: { padding: '8px 14px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' },
    queueInput: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #333', background: '#2a2a5a', color: '#fff', fontSize: '0.85rem', outline: 'none' },
    playlistItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '0.85rem', borderBottom: '1px solid #222' },
    playlistTitle: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    playlistRemove: { background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', padding: '2px 6px' },
    playlistNow: { background: '#2a2a5a', padding: '10px', borderRadius: '8px', marginBottom: '8px' },
    playlistNowLabel: { fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', marginBottom: '4px' },
    playlistNowTitle: { fontWeight: 600, fontSize: '0.9rem' },
  };

  return (
    <div style={styles.container}>
      <div style={styles.main}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 700, color: '#6c63ff' }}>ETC</span>
            <span style={styles.badge}>{code}</span>
            <span style={{ fontSize: '0.85rem', color: '#888' }}>{participants.length} online</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!callActive ? (
              <button style={styles.callBtn} onClick={joinCallInternal}>Join Call</button>
            ) : (
              <button style={{ ...styles.callBtn, ...styles.callBtnActive }} onClick={leaveCallInternal}>Leave Call</button>
            )}
            <button style={styles.leaveBtn} onClick={() => navigate('/')}>Leave</button>
          </div>
        </div>

        <div style={styles.videoArea}>
          {mediaSource ? (
            <>
              {mediaSource.source_type === 'youtube' ? (
                <iframe
                  src={`https://www.youtube.com/embed/${mediaSource.source_url}?autoplay=${isPlaying ? 1 : 0}&enablejsapi=1`}
                  style={{ flex: 1, border: 'none', maxWidth: '100%' }}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <div style={styles.playerWrap}>
                  <video
                    ref={playerRef}
                    src={mediaSource.source_url}
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                    controls
                    onPlay={() => { setIsPlaying(true); sendMessage('media.play', { current_time: playerRef.current?.currentTime || 0 }); }}
                    onPause={() => { setIsPlaying(false); sendMessage('media.pause', { current_time: playerRef.current?.currentTime || 0 }); }}
                    onSeeked={() => sendMessage('media.seek', { current_time: playerRef.current?.currentTime || 0 })}
                  />
                </div>
              )}
              <div style={styles.controls}>
                <button style={styles.ctrlBtn} onClick={togglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
              </div>
            </>
          ) : (
            <div style={styles.playerWrap}>
              <div style={styles.emptyPlayer}>Paste a video URL to start watching together</div>
            </div>
          )}
          <div style={styles.videoInput}>
            <input
              style={styles.urlInput}
              placeholder="YouTube URL or direct video link"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVideoUrl()}
            />
            <button style={styles.loadBtn} onClick={handleVideoUrl}>Load</button>
          </div>
        </div>
      </div>

      <div style={styles.sidebar}>
        <div style={styles.sidebarSection}>
          <div style={styles.sectionTitle}>In Room ({participants.length})</div>
          {participants.map((p) => (
            <div key={p.user_id} style={styles.userItem}>
              <div style={styles.avatar}>{p.username?.[0]?.toUpperCase() || '?'}</div>
              <span>{p.username || 'User'} {p.user_id === user?.id && <span style={{ color: '#888', fontSize: '0.8rem' }}>(you)</span>}</span>
            </div>
          ))}
        </div>

        <div style={styles.sidebarSection}>
          <div style={styles.sectionTitle}>Queue</div>
          {nowPlaying && (
            <div style={styles.playlistNow}>
              <div style={styles.playlistNowLabel}>Now Playing</div>
              <div style={styles.playlistNowTitle}>{nowPlaying.title || nowPlaying.source_url}</div>
              {nowPlaying.artist && <div style={{ color: '#888', fontSize: '0.8rem' }}>{nowPlaying.artist}</div>}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button style={{ ...styles.ctrlBtn, padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => sendMessage('playlist.skip', {})}>Skip</button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <input style={styles.queueInput} placeholder="Add YouTube URL or link" value={queueInput} onChange={(e) => setQueueInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && queueVideo()} />
            <button style={styles.queueBtn} onClick={queueVideo}>Queue</button>
          </div>
          {playlist.length === 0 ? (
            <div style={{ color: '#555', fontSize: '0.85rem' }}>Queue is empty</div>
          ) : (
            playlist.map((item, i) => (
              <div key={item.id} style={styles.playlistItem}>
                <span style={{ color: '#888', fontSize: '0.8rem', minWidth: '16px' }}>{i + 1}.</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.playlistTitle}>{item.title || item.source_url}</div>
                  {item.added_name && <div style={{ color: '#555', fontSize: '0.75rem' }}>by {item.added_name}</div>}
                </div>
                <button style={styles.playlistRemove} onClick={() => sendMessage('playlist.remove', { item_id: item.id })}>×</button>
              </div>
            ))
          )}
        </div>

        <div style={{ ...styles.sidebarSection, borderBottom: 'none' }}>
          <div style={styles.sectionTitle}>Chat</div>
        </div>
        <div style={styles.chatArea}>
          {messages.map((msg) => (
            <div key={msg.id} style={styles.chatMsg}>
              <span style={{ ...styles.chatUser, ...(msg.user_id === user?.id ? styles.ownMsg : {}) }}>{msg.username}</span>
              <span>{msg.content}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div style={styles.chatInput}>
          <input
            style={styles.chatField}
            placeholder="Message"
            value={msgInput}
            onChange={(e) => setMsgInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
          />
          <button style={styles.sendBtn} onClick={sendChat}>Send</button>
        </div>
      </div>

      {callActive && (
        <div style={styles.callOverlay}>
          <div style={styles.callHeader}>
            <span style={{ fontWeight: 600 }}>Voice Call</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                style={{ background: 'transparent', border: '1px solid #444', color: '#aaa', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                onClick={toggleMute}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                style={{ background: 'transparent', border: '1px solid #444', color: cameraOn ? '#22c55e' : '#aaa', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                onClick={toggleCamera}
              >
                {cameraOn ? 'Cam On' : 'Cam Off'}
              </button>
            </div>
          </div>
          <div style={styles.callGrid}>
            <div style={styles.callParticipant}>
              <video ref={localVideoRef} muted autoPlay playsInline style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', background: '#333' }} />
              <div style={{ color: '#888', marginTop: '4px' }}>You {isMuted && '(muted)'}</div>
            </div>
            {participants.filter((p) => p.user_id !== user?.id).map((p) => (
              <div key={p.user_id} style={styles.callParticipant}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '1.5rem' }}>
                  {p.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ color: '#888', marginTop: '4px' }}>{p.username || 'User'}</div>
              </div>
            ))}
          </div>
          {!liveKitToken && (
            <div style={{ color: '#888', fontSize: '0.75rem', textAlign: 'center', marginTop: '8px' }}>
              LiveKit server not configured — using P2P audio
            </div>
          )}
        </div>
      )}
    </div>
  );
}
