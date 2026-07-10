package social

import "time"

type FriendshipStatus string

const (
	StatusPending  FriendshipStatus = "pending"
	StatusAccepted FriendshipStatus = "accepted"
	StatusDeclined FriendshipStatus = "declined"
)

type Friendship struct {
	ID          string           `json:"id"`
	RequesterID string           `json:"requester_id"`
	AddresseeID string           `json:"addressee_id"`
	Status      FriendshipStatus `json:"status"`
	CreatedAt   time.Time        `json:"created_at"`
}

type UserProfile struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name,omitempty"`
	AvatarURL   string  `json:"avatar_url,omitempty"`
	Bio         string  `json:"bio,omitempty"`
	IsFriend    bool    `json:"is_friend"`
	IsPending   bool    `json:"is_pending"`  // outgoing pending request
	IsIncoming  bool    `json:"is_incoming"` // they sent you a request
}

type FriendRequest struct {
	ID          string    `json:"id"`
	User        UserProfile `json:"user"`
	CreatedAt   time.Time `json:"created_at"`
}
