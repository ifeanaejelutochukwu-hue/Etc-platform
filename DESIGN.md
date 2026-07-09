# ETC (Easy Talk and Connect) — System Design

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React + Vite)                       │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │   Room UI   │  │  Media   │  │  Voice   │  │   Chat UI        │ │
│  │ (Layout)    │  │  Player  │  │  Call UI │  │ (Messages,       │ │
│  │             │  │ (YT/HTML5)│  │ (Overlay)│  │  Reactions,      │ │
│  │             │  │          │  │          │  │  Replies)         │ │
│  └──────┬──────┘  └────┬─────┘  └────┬─────┘  └────────┬──────────┘ │
│         │              │             │                  │            │
│    ┌────┴──────────────┴─────────────┴──────────────────┴─────┐      │
│    │              WebSocket (WS) + REST + LiveKit SDK          │      │
│    └──────────────────────────┬────────────────────────────────┘      │
└───────────────────────────────┼──────────────────────────────────────┘
                                │
        ┌───────────────────────┼─────────────────────────────┐
        │                       │                             │
┌───────┴────────┐    ┌─────────┴────────┐    ┌──────────────┴───────┐
│   Go API + WS  │    │   LiveKit SFU    │    │   Media Service     │
│   (gorilla/ws) │    │   (WebRTC)       │    │   (Go + FFmpeg)     │
│   Port: 8080    │    │   Port: 7880     │    │   Port: 8090        │
│                 │    │                  │    │                     │
│  ─ Auth         │    │  ─ Voice rooms   │    │  ─ Transcoding      │
│  ─ Room mgmt   │    │  ─ Video calls   │    │  ─ HLS generation   │
│  ─ Chat         │    │  ─ Screen share  │    │  ─ Upload handling   │
│  ─ Sync events  │    │  ─ Audio tracks  │    │  ─ Thumbnails       │
│  ─ Presence     │    │                  │    │                     │
└────────┬────────┘    └─────────┬────────┘    └────────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────┴────────────┐
         │       Redis            │
         │   ─ Pub/Sub (scale)    │
         │   ─ Room state cache   │
         │   ─ Presence           │
         │   ─ Rate limiting      │
         └────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │     PostgreSQL         │
         │   ─ Users              │
         │   ─ Rooms              │
         │   ─ Messages           │
         │   ─ Media metadata     │
         │   ─ Contacts           │
         └────────────────────────┘
```

## 2. Data Models

### User
```
User {
  id: UUID (PK)
  phone: string (unique)        // WhatsApp-style phone auth
  username: string
  display_name: string
  avatar_url: string?
  status: string?                // "online", "away", "busy"
  last_seen: timestamp
  created_at: timestamp
}
```

### Contact
```
Contact {
  user_id: UUID (FK → User)       // composite PK
  contact_id: UUID (FK → User)    // composite PK
  added_at: timestamp
  is_blocked: boolean
}
```

### Room
```
Room {
  id: UUID (PK)
  code: string (unique, short)
  name: string?
  type: enum[watch, music, voice, group]
  owner_id: UUID (FK → User)
  is_active: boolean
  created_at: timestamp
}
```

### RoomParticipant
```
RoomParticipant {
  room_id: UUID (FK → Room)       // composite PK
  user_id: UUID (FK → User)       // composite PK
  role: enum[host, moderator, member]
  joined_at: timestamp
  is_muted: boolean
  is_speaking: boolean
  livekit_identity: string
}
```

### Message
```
Message {
  id: UUID (PK)
  room_id: UUID (FK → Room)
  sender_id: UUID (FK → User)
  reply_to: UUID? (FK → Message)  // reply chain
  type: enum[text, image, voice_note, file, system, reaction]
  content: text                    // JSON — flexible
  created_at: timestamp
  edited_at: timestamp?
}
```

### MessageDelivery
```
MessageDelivery {
  message_id: UUID (FK → Message)  // composite PK
  user_id: UUID (FK → User)        // composite PK
  status: enum[sent, delivered, read]
  read_at: timestamp?
}
```

### MediaSession (current playback state)
```
MediaSession {
  id: UUID (PK)
  room_id: UUID (FK → Room)
  source_type: enum[youtube, vimeo, direct_url, local_file, audio_track]
  source_url: string
  title: string?
  artist: string?                  // for music mode
  started_by: UUID (FK → User)
  is_playing: boolean
  current_time: float
  started_at: timestamp
  queued_by: UUID? (FK → User)
  playlist_position: int?
}
```

### PlaylistItem
```
PlaylistItem {
  id: UUID (PK)
  room_id: UUID (FK → Room)
  source_type: enum[youtube, vimeo, direct_url, local_file, audio_track]
  source_url: string
  title: string
  artist: string?
  duration: int                    // seconds
  added_by: UUID (FK → User)
  position: int
  created_at: timestamp
}
```

## 3. REST API

### Auth
```
POST   /api/auth/request-otp      { phone } → { success }
POST   /api/auth/verify-otp       { phone, code } → { token, user }
POST   /api/auth/refresh          { refresh_token } → { token }
```

### Users
```
GET    /api/users/me              → { user }
PATCH  /api/users/me              { display_name, avatar, status } → { user }
GET    /api/users/:id             → { user }
```

### Contacts
```
GET    /api/contacts              → [{ user }]
POST   /api/contacts              { phone } → { contact }
DELETE /api/contacts/:id          → { success }
POST   /api/contacts/sync         { phone_numbers: [string] } → [{ user }]
```

### Rooms
```
POST   /api/rooms                 { name?, type } → { room, livekit_token }
GET    /api/rooms/:code           → { room, participants }
DELETE /api/rooms/:code           → { success }
PATCH  /api/rooms/:code           { name } → { room }
POST   /api/rooms/:code/join      → { room, livekit_token }
POST   /api/rooms/:code/leave     → { success }
```

### Messages
```
GET    /api/rooms/:code/messages  ?before=id&limit=50 → [{ message }]
POST   /api/rooms/:code/messages  { type, content, reply_to? } → { message }
PATCH  /api/messages/:id          { content } → { message }
DELETE /api/messages/:id          → { success }
POST   /api/messages/:id/react    { emoji } → { success }     // reaction
POST   /api/messages/:id/read     → { success }                // mark read
```

### Media
```
POST   /api/rooms/:code/media/playlist   { items } → { playlist }
GET    /api/rooms/:code/media/playlist   → [{ item }]
POST   /api/rooms/:code/media/queue      { item } → { playlist }
DELETE /api/rooms/:code/media/queue/:id  → { success }
POST   /api/rooms/:code/media/sync       { action: play|pause|seek, time } → { success }
PUT    /api/rooms/:code/media/now        { source_type, source_url, title? } → { session }
```

### Uploads
```
POST   /api/upload              multipart → { url }
```

## 4. WebSocket Protocol

Connection: `ws://host:8080/ws?token=jwt`

### Client → Server Events

```
auth                { token }
room.join           { room_code }
room.leave          {}
media.play          { current_time }
media.pause         { current_time }
media.seek          { current_time }
media.change        { source_type, source_url, title?, artist? }
media.queue.add     { source_type, source_url, title?, artist?, duration? }
media.queue.remove  { item_id }
chat.send           { message_type: "text"|"reaction", content, reply_to? }
chat.typing         { is_typing: bool }
call.mute           { is_muted: bool }
call.speaking       { is_speaking: bool }
presence            { status: "online"|"away"|"busy" }
```

### Server → Client Events

```
room.joined         { room, participants, media_session, livekit_token }
room.left           { user_id, username }
room.participant_joined  { user }
room.participant_left    { user_id }
room.updated        { room }

media.play          { user_id, current_time }
media.pause         { user_id, current_time }
media.seek          { user_id, current_time }
media.changed       { user_id, media_session }
media.queue.updated { playlist }

chat.message        { message }       // always includes delivery info
chat.typing         { user_id, username, is_typing }
chat.delivered      { message_id, user_id }
chat.read           { message_id, user_id, read_at }

call.mute           { user_id, is_muted }
call.speaking       { user_id, is_speaking }

presence            { user_id, status }

error               { code, message }
```

## 5. Component Architecture (Go Backend)

```
cmd/etc-server/main.go           ← entry point, wires everything
internal/
├── server/
│   ├── server.go                ← HTTP + WS server setup (chi router)
│   └── middleware.go             ← Auth, CORS, rate limit, logging
├── auth/
│   ├── handler.go               ← REST handlers (OTP, verify, refresh)
│   ├── service.go               ← Business logic for auth
│   └── jwt.go                   ← JWT generation + validation
├── user/
│   ├── handler.go
│   ├── service.go
│   ├── repository.go            ← PostgreSQL queries
│   └── model.go
├── contact/
│   ├── handler.go
│   ├── service.go
│   └── repository.go
├── room/
│   ├── handler.go               ← REST handlers
│   ├── ws_handler.go            ← WebSocket event handlers
│   ├── service.go               ← Room logic
│   ├── hub.go                   ← In-memory room state + socket management
│   └── model.go
├── chat/
│   ├── handler.go               ← REST + WS handlers for messages
│   ├── service.go
│   ├── repository.go
│   └── model.go
├── media/
│   ├── handler.go               ← REST + WS handlers
│   ├── service.go               ← Playlist, sync logic
│   ├── transcoder.go            ← FFmpeg integration
│   └── model.go
├── call/
│   ├── service.go               ← LiveKit token generation, room mgmt
│   └── model.go
├── upload/
│   ├── handler.go               ← Multipart upload handler
│   └── service.go               ← S3/local storage
├── presence/
│   └── service.go               ← Online status tracking
└── pkg/
    ├── ws/
    │   ├── client.go            ← Per-connection reader/writer
    │   └── message.go           ← Message types
    ├── db/
    │   └── postgres.go          ← Connection pool
    ├── cache/
    │   └── redis.go             ← Redis client + helpers
    └── config/
        └── config.go            ← Env-based config
```

## 6. Room Lifecycle

```
  ┌─────────┐
  │  User A  │  creates room → POST /api/rooms → { code: "ABC123" }
  └────┬─────┘
       │
       ▼
  ┌─────────┐     ┌──────────────────┐
  │  Room   │────▶│  User A connects │  ws → { type: "room.join", ... }
  │  Active │     │  WebSocket       │
  └────┬─────┘     └──────────────────┘
       │
       │  User B joins: POST /api/rooms/ABC123/join
       │  → WebSocket: { type: "room.participant_joined", user: B }
       │  → LiveKit: B joins voice room
       ▼
  ┌─────────┐
  │  Both   │  ↔  Media sync events
  │  Watch  │  ↔  Chat messages (persisted)
  │  /Talk  │  ↔  Voice call via LiveKit (WebRTC)
  └────┬─────┘
       │
       ▼
  ┌─────────┐
  │  Room   │  ← All users leave or timeout
  │  Ends   │
  └─────────┘
```

## 7. Sync Protocol (Media)

Synchronization uses **Hybrid Sync**:

1. **Event-driven** (realtime for actions): Play, pause, seek → broadcast to room via WS.
2. **Heartbeat** (periodic correction): Host broadcasts `{ current_time, timestamp }` every 5s. Guests adjust their playback to match.
3. **On join**: New guest receives current `MediaSession` state → cues video to correct position.

Goal: <200ms drift between participants under normal conditions.

## 8. Scaling

```
Scale Layer        │ Solution
───────────────────┼──────────────────────────────
WS connections      │ Go gorilla/ws + Redis pub/sub
                    │ Room state in Redis → any server can route to room
HTTP throughput     │ Stateless Go servers behind LB
WebRTC              │ LiveKit SFU auto-scales
Database            │ PostgreSQL read replicas
File uploads        │ S3-compatible storage (MinIO for self-hosted)
Media transcoding   │ Go + FFmpeg in worker pool (NATS queue)
```

**Go backend scaling pattern:**
- Multiple Go servers behind load balancer
- Each server handles WS connections
- Redis pub/sub connects all servers so a WS message in server A reaches users in server B
- Room state stored in Redis (fast read/write), async persisted to PostgreSQL

## 9. Folder Structure

```
etc/
├── backend/                  ← Go backend
│   ├── cmd/etc-server/
│   ├── internal/...          ← as described above
│   ├── go.mod
│   └── go.sum
├── frontend/                 ← React + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/         ← WS client, API client
│   │   └── stores/           ← State management
│   ├── package.json
│   └── vite.config.js
├── design/                   ← Design docs, schema, etc.
└── docker-compose.yml        ← Dev environment (Postgres, Redis, LiveKit, MinIO)
```

## 10. Core Dependencies (Go)

```
github.com/go-chi/chi/v5         ← HTTP router
github.com/gorilla/websocket      ← WebSocket
github.com/jackc/pgx/v5           ← PostgreSQL driver
github.com/redis/go-redis/v9      ← Redis client
github.com/golang-jwt/jwt/v5      ← JWT
github.com/google/uuid            ← UUID generation
github.com/livekit/server-sdk-go  ← LiveKit server SDK
github.com/rs/cors                ← CORS
github.com/joho/godotenv          ← .env loader
go.uber.org/zap                   ← Structured logging
```
