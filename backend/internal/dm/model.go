package dm

import "time"

type Conversation struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // "direct" | "group"
	Name        string    `json:"name,omitempty"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	// Populated at query time
	Members     []Member  `json:"members,omitempty"`
	LastMessage *Message  `json:"last_message,omitempty"`
	UnreadCount int       `json:"unread_count"`
}

type Member struct {
	UserID      string    `json:"user_id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name,omitempty"`
	AvatarURL   string    `json:"avatar_url,omitempty"`
	JoinedAt    time.Time `json:"joined_at"`
}

type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	SenderID       string    `json:"sender_id"`
	SenderUsername string    `json:"sender_username,omitempty"`
	Content        string    `json:"content"`
	MsgType        string    `json:"msg_type"` // "text" | "watch_invite"
	CreatedAt      time.Time `json:"created_at"`
}
