package room

import "time"

type RoomType string

const (
	RoomTypeWatch RoomType = "watch"
	RoomTypeMusic RoomType = "music"
	RoomTypeVoice RoomType = "voice"
	RoomTypeGroup RoomType = "group"
)

type ParticipantRole string

const (
	RoleHost     ParticipantRole = "host"
	RoleModerator ParticipantRole = "moderator"
	RoleMember   ParticipantRole = "member"
)

type Room struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name,omitempty"`
	Type      RoomType  `json:"type"`
	OwnerID   string    `json:"owner_id"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Participant struct {
	UserID   string          `json:"user_id"`
	Username string          `json:"username"`
	Role     ParticipantRole `json:"role"`
	IsMuted  bool            `json:"is_muted"`
	JoinedAt time.Time       `json:"joined_at"`
}

type CreateRoomRequest struct {
	Name string   `json:"name,omitempty"`
	Type RoomType `json:"type"`
}

type JoinRoomResponse struct {
	Room         *Room          `json:"room"`
	Participants []*Participant `json:"participants"`
	LiveKitToken string         `json:"livekit_token,omitempty"`
}
