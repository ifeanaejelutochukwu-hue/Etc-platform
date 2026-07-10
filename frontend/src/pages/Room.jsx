import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { connectWebSocket, sendMessage, onMessage, disconnectWebSocket } from '../services/ws';
import { Room as LKRoom } from 'livekit-client';
import Avatar from '../components/Avatar';

/* ── SVG Icons ──────────────────────────────────────────────────────────────── */
const Ic = {
  Back:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Send:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Play:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Pause:  () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Skip:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5"/></svg>,
  Plus:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  X:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Mic:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  MicOff: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7 7 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 11.95 4.95"/><path d="M15 9.34V5a3 3 0 0 0-5.94-.6"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  Phone:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.64 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.08 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.34 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Share:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Chat:   () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Users:  () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  List:   () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Video:  () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
};

/* ── Reaction emojis ────────────────────────────────────────────────────────── */
const REACTIONS = ['❤️','🔥','😂','👏','😮','💯'];

/* ── Floating reaction ─────────────────────────────────────────────────────── */
function FloatingReaction({ emoji, id }) {
  const left = 10 + Math.random() * 80;
  return (
    <div key={id} style={{
      position:'absolute', bottom:60, left:`${left}%`,
      fontSize:'2rem', pointerEvents:'none', zIndex:80,
      animation:'floatUp 1.8s var(--ease) forwards',
    }}>
      {emoji}
    </div>
  );
}

/* ── Main Room component ────────────────────────────────────────────────────── */
export default function Room() {
  const { code } = useParams();
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);

  /* State */
  const [participants, setParticipants] = useState([]);
  const [messages,     setMessages]     = useState([]);
  const [msgInput,     setMsgInput]     = useState('');
  const [typingUsers,  setTypingUsers]  = useState({});
  const [mediaSource,  setMediaSource]  = useState(null);
  const [videoUrl,     setVideoUrl]     = useState('');
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [playlist,     setPlaylist]     = useState([]);
  const [nowPlaying,   setNowPlaying]   = useState(null);
  const [queueInput,   setQueueInput]   = useState('');
  const [callActive,   setCallActive]   = useState(false);
  const [isMuted,      setIsMuted]      = useState(false);
  const [lkToken,      setLkToken]      = useState(null);
  const [activeTab,    setActiveTab]    = useState('chat');
  const [reactions,    setReactions]    = useState([]);   // [{id,emoji}]
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [showUrlBar,   setShowUrlBar]   = useState(false);

  /* Refs */
  const playerRef      = useRef(null);
  const chatEndRef     = useRef(null);
  const localVideoRef  = useRef(null);
  const lkRoomRef      = useRef(null);
  const localStreamRef = useRef(null);
  const typingTimer    = useRef(null);

  /* ── WebSocket ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    connectWebSocket();
    sendMessage('room.join', { room_code: code });

    const u1  = onMessage('room.joined',            (p) => { setParticipants(p.participants||[]); if(p.livekit_token) setLkToken(p.livekit_token); });
    const u2  = onMessage('room.participant_joined', (p) => setParticipants((prev) => prev.find((x)=>x.user_id===p.user_id)?prev:[...prev,p]));
    const u3  = onMessage('room.participant_left',   (p) => setParticipants((prev) => prev.filter((x)=>x.user_id!==p.user_id)));
    const u4  = onMessage('chat.message',            (p) => setMessages((prev)=>[...prev,{id:p.id||Date.now(),user_id:p.user_id,username:p.username||'User',content:p.content??'',ts:Date.now()}]));
    const u5  = onMessage('chat.typing',             (p) => { if(p.user_id===user?.id)return; setTypingUsers((prev)=>({...prev,[p.user_id]:p.is_typing?(p.username||p.user_id):null})); });
    const u6  = onMessage('media.play',              (p) => { setIsPlaying(true);  if(playerRef.current){playerRef.current.currentTime=p.current_time||0;playerRef.current.play().catch(()=>{});} });
    const u7  = onMessage('media.pause',             (p) => { setIsPlaying(false); if(playerRef.current){playerRef.current.currentTime=p.current_time||0;playerRef.current.pause();} });
    const u8  = onMessage('media.seek',              (p) => { if(playerRef.current) playerRef.current.currentTime=p.current_time||0; });
    const u9  = onMessage('media.changed',           (p) => { setMediaSource(p); setIsPlaying(false); });
    const u10 = onMessage('playlist.updated',        (p) => setPlaylist(p.items||[]));
    const u11 = onMessage('playlist.now_playing',    (p) => { setNowPlaying(p.item); setMediaSource({source_type:p.item?.source_type,source_url:p.item?.source_url,title:p.item?.title}); setIsPlaying(true); });
    const u12 = onMessage('reaction',                (p) => addReaction(p.emoji));

    return () => {
      sendMessage('room.leave',{}); disconnectWebSocket();
      [u1,u2,u3,u4,u5,u6,u7,u8,u9,u10,u11,u12].forEach((u)=>u());
      stopCall();
    };
  }, [code]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  /* ── Reactions ──────────────────────────────────────────────────────────── */
  function addReaction(emoji) {
    const id = Date.now() + Math.random();
    setReactions((prev) => [...prev, { id, emoji }]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2000);
  }

  function sendReaction(emoji) {
    sendMessage('reaction', { emoji });
    addReaction(emoji);
    setShowReactPicker(false);
  }

  /* ── Media ──────────────────────────────────────────────────────────────── */
  const loadUrl = useCallback(() => {
    const v = videoUrl.trim(); if (!v) return;
    const yt = v.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const payload = yt ? {source_type:'youtube',source_url:yt[1],title:v} : {source_type:'direct_url',source_url:v,title:v};
    setMediaSource(payload); sendMessage('media.change', payload); setVideoUrl(''); setShowUrlBar(false);
  }, [videoUrl]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) { playerRef.current.pause(); sendMessage('media.pause',{current_time:playerRef.current.currentTime}); }
    else           { playerRef.current.play().catch(()=>{}); sendMessage('media.play',{current_time:playerRef.current.currentTime}); }
    setIsPlaying((p)=>!p);
  }, [isPlaying]);

  const addToQueue = useCallback(() => {
    const v = queueInput.trim(); if (!v) return;
    const yt = v.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    sendMessage('playlist.add', yt?{source_type:'youtube',source_url:yt[1],title:v,duration:0}:{source_type:'direct_url',source_url:v,title:v,duration:0});
    setQueueInput('');
  }, [queueInput]);

  /* ── Chat ───────────────────────────────────────────────────────────────── */
  const sendChat = useCallback(() => {
    if (!msgInput.trim()) return;
    sendMessage('chat.send',{message_type:'text',content:msgInput});
    setMsgInput(''); sendMessage('chat.typing',{is_typing:false});
  }, [msgInput]);

  const onChatKey = useCallback((e) => {
    if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();return;}
    sendMessage('chat.typing',{is_typing:true});
    clearTimeout(typingTimer.current);
    typingTimer.current=setTimeout(()=>sendMessage('chat.typing',{is_typing:false}),2000);
  },[sendChat]);

  /* ── Call ───────────────────────────────────────────────────────────────── */
  async function startCall() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      localStreamRef.current = stream;
      setCallActive(true);
      if (lkToken) {
        const room = new LKRoom();
        room.on('participantConnected', (p)=>p.on('trackSubscribed',(t)=>{}));
        await room.connect(import.meta.env.VITE_LIVEKIT_URL||'ws://localhost:7880', lkToken);
        await room.localParticipant.setMicrophoneEnabled(true);
        lkRoomRef.current = room;
      }
    } catch(err){ console.error('[call]',err); }
  }

  function stopCall() {
    localStreamRef.current?.getTracks().forEach((t)=>t.stop()); localStreamRef.current=null;
    lkRoomRef.current?.disconnect(); lkRoomRef.current=null;
    setCallActive(false);
  }

  const toggleMute = useCallback(()=>{
    localStreamRef.current?.getAudioTracks().forEach((t)=>{t.enabled=isMuted;});
    const next=!isMuted; setIsMuted(next); sendMessage('call.mute',{is_muted:next});
  },[isMuted]);

  /* ── Share / copy ───────────────────────────────────────────────────────── */
  const shareRoom = () => {
    const url = `${window.location.origin}/room/${code}`;
    if (navigator.share) {
      navigator.share({ title:'Join my ETC room', text:`Watch with me! Code: ${code}`, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(()=>setCopied(false),2000);
    }
  };

  const typingText = Object.values(typingUsers).filter(Boolean).join(', ');

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div style={S.root}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header style={S.topBar}>
        <button style={S.iconBtn} onClick={()=>navigate('/')}><Ic.Back /></button>
        <div style={S.topCenter}>
          <span style={S.topTitle}>{code}</span>
          <div style={S.liveRow}>
            <span style={S.liveDot} />
            <span style={S.liveText}>{participants.length} watching</span>
          </div>
        </div>
        <div style={S.topRight}>
          <button style={S.iconBtn} onClick={shareRoom} title="Share room">
            {copied ? <span style={{fontSize:'0.8rem',fontWeight:700,color:'var(--green)'}}>✓</span> : <Ic.Share />}
          </button>
          {callActive ? (
            <button style={{...S.callBtn,...S.callBtnRed}} onClick={stopCall}>End</button>
          ) : (
            <button style={S.callBtn} onClick={startCall}><Ic.Phone /> Call</button>
          )}
        </div>
      </header>

      {/* ── Video area ──────────────────────────────────────────────────── */}
      <div style={S.videoWrap}>
        {!mediaSource ? (
          <div style={S.videoEmpty}>
            <div style={{fontSize:'3rem',marginBottom:8}}>🎬</div>
            <p style={S.emptyTitle}>Nothing playing yet</p>
            <p style={S.emptySub}>Tap the video icon below to load a YouTube link</p>
          </div>
        ) : mediaSource.source_type==='youtube' ? (
          <iframe key={mediaSource.source_url} style={S.iframe}
            src={`https://www.youtube.com/embed/${mediaSource.source_url}?autoplay=1&enablejsapi=1`}
            allow="autoplay;encrypted-media;fullscreen" allowFullScreen title="video" />
        ) : (
          <video ref={playerRef} key={mediaSource.source_url} style={S.videoEl}
            onPlay={()=>{setIsPlaying(true);sendMessage('media.play',{current_time:playerRef.current?.currentTime||0});}}
            onPause={()=>{setIsPlaying(false);sendMessage('media.pause',{current_time:playerRef.current?.currentTime||0});}}
            onSeeked={()=>sendMessage('media.seek',{current_time:playerRef.current?.currentTime||0})}
            src={mediaSource.source_url} />
        )}

        {/* Floating reactions */}
        {reactions.map((r)=><FloatingReaction key={r.id} emoji={r.emoji} id={r.id} />)}

        {/* Reaction picker trigger */}
        <button style={S.reactTrigger} onClick={()=>setShowReactPicker((p)=>!p)}>😄</button>
        {showReactPicker && (
          <div style={S.reactPicker}>
            {REACTIONS.map((e)=>(
              <button key={e} style={S.reactBtn} onClick={()=>sendReaction(e)}>{e}</button>
            ))}
          </div>
        )}

        {/* Video controls overlay */}
        {mediaSource && (
          <div style={S.videoControls}>
            {mediaSource.source_type!=='youtube' && (
              <button style={S.vidCtrlBtn} onClick={togglePlay}>
                {isPlaying?<Ic.Pause/>:<Ic.Play/>}
              </button>
            )}
            <button style={S.vidCtrlBtn} onClick={()=>sendMessage('playlist.skip',{})}><Ic.Skip/></button>
            {callActive && (
              <button style={{...S.vidCtrlBtn,...(isMuted?S.vidCtrlRed:{})}} onClick={toggleMute}>
                {isMuted?<Ic.MicOff/>:<Ic.Mic/>}
              </button>
            )}
          </div>
        )}

        {/* URL input sheet */}
        {showUrlBar && (
          <div style={S.urlSheet}>
            <input style={S.urlInput} placeholder="Paste YouTube or video URL"
              value={videoUrl} onChange={(e)=>setVideoUrl(e.target.value)}
              onKeyDown={(e)=>e.key==='Enter'&&loadUrl()} autoFocus />
            <button style={S.urlBtn} onClick={loadUrl}>Load</button>
            <button style={S.urlCancel} onClick={()=>setShowUrlBar(false)}><Ic.X/></button>
          </div>
        )}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div style={S.tabContent}>

        {/* Chat */}
        {activeTab==='chat' && (
          <>
            <div style={S.chatFeed}>
              {messages.length===0 && (
                <div style={S.chatEmpty}><span style={{fontSize:'2rem'}}>💬</span><p>Say hello!</p></div>
              )}
              {messages.map((m)=>{
                const own = m.user_id===user?.id;
                return (
                  <div key={m.id} style={{...S.msgRow,...(own?S.msgRowOwn:{})}}>
                    {!own && <Avatar name={m.username} size={30} style={{flexShrink:0,marginTop:2}} />}
                    <div style={{maxWidth:'72%',display:'flex',flexDirection:'column',gap:2,alignItems:own?'flex-end':'flex-start'}}>
                      {!own && <span style={S.msgName}>{m.username}</span>}
                      <div style={{...S.bubble,...(own?S.bubbleOut:S.bubbleIn)}}>
                        <span style={{...S.bubbleTxt,...(own?S.bubbleTxtOut:{})}}>{m.content}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {typingText && <p style={S.typing}>✍️ {typingText} is typing…</p>}
              <div ref={chatEndRef} />
            </div>
            <div style={S.chatBar}>
              <input style={S.chatInput} placeholder="Message…" value={msgInput}
                onChange={(e)=>setMsgInput(e.target.value)} onKeyDown={onChatKey} />
              <button style={{...S.sendBtn,...(!msgInput.trim()?S.sendBtnDim:{})}}
                onClick={sendChat} disabled={!msgInput.trim()}><Ic.Send/></button>
            </div>
          </>
        )}

        {/* People */}
        {activeTab==='people' && (
          <div style={S.pane}>
            <p style={S.paneTitle}>In this room ({participants.length})</p>
            {participants.map((p)=>(
              <div key={p.user_id} style={S.personRow}>
                <Avatar name={p.username} size={40} />
                <div style={S.personMeta}>
                  <span style={S.personName}>{p.username}{p.user_id===user?.id&&<span style={S.youChip}> · you</span>}</span>
                  <span style={S.personRole}>{p.role||'member'}</span>
                </div>
                {p.is_muted && <span>🔇</span>}
              </div>
            ))}
            {participants.length===0 && <p style={S.paneEmpty}>Nobody here yet.</p>}
          </div>
        )}

        {/* Queue */}
        {activeTab==='queue' && (
          <div style={S.pane}>
            <div style={S.queueAddRow}>
              <input style={S.queueInput} placeholder="YouTube or video URL"
                value={queueInput} onChange={(e)=>setQueueInput(e.target.value)}
                onKeyDown={(e)=>e.key==='Enter'&&addToQueue()} />
              <button style={S.queueAddBtn} onClick={addToQueue}><Ic.Plus/></button>
            </div>
            {nowPlaying && (
              <div style={S.npCard}>
                <span style={S.npLabel}>▶ NOW PLAYING</span>
                <p style={S.npTitle}>{nowPlaying.title||nowPlaying.source_url}</p>
              </div>
            )}
            {playlist.length===0&&!nowPlaying && <p style={S.paneEmpty}>Queue is empty.</p>}
            {playlist.map((item,i)=>(
              <div key={item.id} style={S.qItem}>
                <span style={S.qNum}>{i+1}</span>
                <div style={S.qMeta}>
                  <span style={S.qTitle}>{item.title||item.source_url}</span>
                  {item.added_name&&<span style={S.qBy}>by {item.added_name}</span>}
                </div>
                <button style={S.qDel} onClick={()=>sendMessage('playlist.remove',{item_id:item.id})}><Ic.X/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────────────── */}
      <nav style={S.bottomNav}>
        {[
          {id:'chat',  icon:<Ic.Chat/>,  label:'Chat'},
          {id:'video', icon:<Ic.Video/>, label:'Video', action:()=>setShowUrlBar(true)},
          {id:'queue', icon:<Ic.List/>,  label:'Queue'},
          {id:'people',icon:<Ic.Users/>, label:'People'},
        ].map((t)=>(
          <button key={t.id} style={{...S.navBtn,...(activeTab===t.id?S.navBtnOn:{})}}
            onClick={()=>{ if(t.action){t.action();}else{setActiveTab(t.id);} }}>
            <span style={{color:activeTab===t.id?'var(--brand)':'var(--txt-2)'}}>{t.icon}</span>
            <span style={{fontSize:'0.68rem',fontWeight:600,color:activeTab===t.id?'var(--brand)':'var(--txt-2)'}}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */
const S = {
  root: { display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)', overflow:'hidden', maxWidth:600, margin:'0 auto' },

  /* Top bar */
  topBar:    { height:54, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', background:'var(--bg)', borderBottom:'1px solid var(--bg-3)', flexShrink:0, gap:8 },
  iconBtn:   { width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', cursor:'pointer', color:'var(--txt)', borderRadius:'var(--r-sm)' },
  topCenter: { flex:1, display:'flex', flexDirection:'column', alignItems:'center' },
  topTitle:  { fontSize:'0.95rem', fontWeight:800, color:'var(--txt)', letterSpacing:'0.05em' },
  liveRow:   { display:'flex', alignItems:'center', gap:5 },
  liveDot:   { width:7, height:7, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 0 2px rgba(16,185,129,0.25)' },
  liveText:  { fontSize:'0.72rem', color:'var(--txt-2)', fontWeight:500 },
  topRight:  { display:'flex', alignItems:'center', gap:6 },
  callBtn:   { display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background:'var(--grad)', color:'#fff', border:'none', borderRadius:'var(--r-full)', fontSize:'0.8rem', fontWeight:700, cursor:'pointer' },
  callBtnRed:{ background:'var(--red)' },

  /* Video */
  videoWrap: { position:'relative', width:'100%', aspectRatio:'16/9', background:'#000', flexShrink:0, overflow:'hidden' },
  videoEmpty:{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0a0a0a', color:'#fff' },
  emptyTitle:{ fontSize:'1rem', fontWeight:700, marginBottom:4 },
  emptySub:  { fontSize:'0.82rem', color:'rgba(255,255,255,0.4)', maxWidth:220, textAlign:'center', lineHeight:1.5 },
  iframe:    { width:'100%', height:'100%', border:'none', display:'block' },
  videoEl:   { width:'100%', height:'100%', objectFit:'contain', display:'block' },

  /* Reaction */
  reactTrigger:{ position:'absolute', bottom:12, right:12, width:40, height:40, borderRadius:'50%', background:'rgba(0,0,0,0.4)', border:'none', fontSize:'1.3rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' },
  reactPicker: { position:'absolute', bottom:58, right:8, display:'flex', gap:6, background:'rgba(255,255,255,0.95)', borderRadius:'var(--r-full)', padding:'6px 10px', boxShadow:'0 4px 20px rgba(0,0,0,0.25)', animation:'popIn 0.2s var(--ease)' },
  reactBtn:    { fontSize:'1.5rem', background:'none', border:'none', cursor:'pointer', padding:'2px 4px', lineHeight:1 },

  /* Video controls overlay */
  videoControls: { position:'absolute', bottom:12, left:12, display:'flex', gap:8 },
  vidCtrlBtn:    { width:38, height:38, borderRadius:'50%', background:'rgba(0,0,0,0.45)', border:'none', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(4px)' },
  vidCtrlRed:    { background:'rgba(239,68,68,0.7)' },

  /* URL sheet */
  urlSheet:  { position:'absolute', bottom:0, left:0, right:0, display:'flex', gap:8, padding:'10px 12px', background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)', animation:'slidUp 0.2s var(--ease)' },
  urlInput:  { flex:1, padding:'10px 14px', background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'var(--r-md)', color:'#fff', fontSize:'0.9rem', outline:'none' },
  urlBtn:    { padding:'10px 16px', background:'var(--brand)', color:'#fff', border:'none', borderRadius:'var(--r-md)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' },
  urlCancel: { width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', borderRadius:'var(--r-md)', cursor:'pointer' },

  /* Tab content */
  tabContent: { flex:1, overflow:'hidden', display:'flex', flexDirection:'column' },

  /* Chat */
  chatFeed:  { flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 },
  chatEmpty: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, color:'var(--txt-2)', textAlign:'center', fontSize:'0.87rem' },
  msgRow:    { display:'flex', alignItems:'flex-start', gap:8 },
  msgRowOwn: { flexDirection:'row-reverse' },
  msgName:   { fontSize:'0.72rem', fontWeight:700, color:'var(--txt-2)', marginLeft:2 },
  bubble:    { padding:'9px 13px', borderRadius:'var(--r-lg)', maxWidth:'100%', lineHeight:1.45 },
  bubbleIn:  { background:'var(--bg-3)', borderBottomLeftRadius:'var(--r-xs)' },
  bubbleOut: { background:'var(--brand)', borderBottomRightRadius:'var(--r-xs)' },
  bubbleTxt: { fontSize:'0.9rem', color:'var(--txt)', wordBreak:'break-word' },
  bubbleTxtOut: { color:'#fff' },
  typing:    { fontSize:'0.75rem', color:'var(--txt-2)', paddingLeft:6, fontStyle:'italic' },
  chatBar:   { display:'flex', gap:8, padding:'8px 12px', borderTop:'1px solid var(--bg-3)', flexShrink:0, background:'var(--bg)', paddingBottom:'calc(8px + var(--sab))' },
  chatInput: { flex:1, padding:'10px 16px', background:'var(--bg-3)', border:'none', borderRadius:'var(--r-full)', color:'var(--txt)', fontSize:'0.9rem', outline:'none' },
  sendBtn:   { width:40, height:40, borderRadius:'50%', background:'var(--grad)', border:'none', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, boxShadow:'0 2px 8px rgba(124,58,237,0.35)' },
  sendBtnDim:{ background:'var(--bg-4)', boxShadow:'none' },

  /* People / Queue pane */
  pane:      { flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:8 },
  paneTitle: { fontSize:'0.78rem', fontWeight:700, color:'var(--txt-2)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 },
  paneEmpty: { color:'var(--txt-2)', fontSize:'0.87rem', textAlign:'center', marginTop:20 },
  personRow: { display:'flex', alignItems:'center', gap:12, padding:'8px 0' },
  personMeta:{ flex:1 },
  personName:{ fontSize:'0.92rem', fontWeight:600, color:'var(--txt)' },
  personRole:{ fontSize:'0.75rem', color:'var(--txt-2)', textTransform:'capitalize' },
  youChip:   { fontSize:'0.72rem', color:'var(--brand)', fontWeight:600 },

  /* Queue */
  queueAddRow:{ display:'flex', gap:8, paddingBottom:12, borderBottom:'1px solid var(--bg-3)', marginBottom:8 },
  queueInput: { flex:1, padding:'10px 14px', background:'var(--bg-3)', border:'none', borderRadius:'var(--r-md)', color:'var(--txt)', fontSize:'0.87rem', outline:'none' },
  queueAddBtn:{ width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--grad)', border:'none', borderRadius:'var(--r-md)', color:'#fff', cursor:'pointer', flexShrink:0 },
  npCard:    { background:'var(--grad-soft)', border:'1px solid rgba(124,58,237,0.15)', borderRadius:'var(--r-lg)', padding:'12px 14px', marginBottom:8 },
  npLabel:   { fontSize:'0.65rem', fontWeight:800, color:'var(--brand)', letterSpacing:'0.1em', marginBottom:4 },
  npTitle:   { fontSize:'0.9rem', fontWeight:600, color:'var(--txt)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  qItem:     { display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--bg-3)' },
  qNum:      { fontSize:'0.75rem', color:'var(--txt-2)', minWidth:18, textAlign:'right' },
  qMeta:     { flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:1 },
  qTitle:    { fontSize:'0.87rem', color:'var(--txt)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500 },
  qBy:       { fontSize:'0.72rem', color:'var(--txt-2)' },
  qDel:      { background:'none', border:'none', color:'var(--txt-2)', cursor:'pointer', display:'flex', alignItems:'center', padding:'4px' },

  /* Bottom nav */
  bottomNav: {
    display:'flex', height:56, borderTop:'1px solid var(--bg-3)',
    background:'var(--bg)', flexShrink:0,
    paddingBottom:'var(--sab)',
  },
  navBtn:  { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:'6px 0' },
  navBtnOn:{ background:'var(--bg-2)' },
};
