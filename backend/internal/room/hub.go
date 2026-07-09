package room

import (
	"sync"
)

type RoomHub struct {
	mu    sync.RWMutex
	rooms map[string]*RoomState
}

type RoomState struct {
	Room  *Room
	Media *MediaState
	Mu    sync.Mutex
}

type MediaState struct {
	SourceType  string  `json:"source_type"`
	SourceURL   string  `json:"source_url"`
	Title       string  `json:"title,omitempty"`
	Artist      string  `json:"artist,omitempty"`
	IsPlaying   bool    `json:"is_playing"`
	CurrentTime float64 `json:"current_time"`
	StartedBy   string  `json:"started_by,omitempty"`
}

func NewRoomHub() *RoomHub {
	return &RoomHub{
		rooms: make(map[string]*RoomState),
	}
}

func (h *RoomHub) CreateRoom(rm *Room) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.rooms[rm.Code] = &RoomState{
		Room:  rm,
		Media: &MediaState{},
	}
}

func (h *RoomHub) GetRoom(code string) (*RoomState, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	rs, ok := h.rooms[code]
	return rs, ok
}

func (h *RoomHub) DeleteRoom(code string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms, code)
}

func (h *RoomHub) UpdateMedia(code string, media *MediaState) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if rs, ok := h.rooms[code]; ok {
		rs.Mu.Lock()
		rs.Media = media
		rs.Mu.Unlock()
	}
}
