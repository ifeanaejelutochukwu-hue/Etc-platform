package chat

import "time"

type MessageType string

const (
	MsgText      MessageType = "text"
	MsgImage     MessageType = "image"
	MsgVoiceNote MessageType = "voice_note"
	MsgFile      MessageType = "file"
	MsgSystem    MessageType = "system"
	MsgReaction  MessageType = "reaction"
)

type Message struct {
	ID        string      `json:"id"`
	RoomID    string      `json:"room_id"`
	SenderID  string      `json:"sender_id"`
	Username  string      `json:"username,omitempty"`
	ReplyTo   *string     `json:"reply_to,omitempty"`
	Type      MessageType `json:"type"`
	Content   string      `json:"content"`
	CreatedAt time.Time   `json:"created_at"`
}

type SendMessageRequest struct {
	Type    MessageType `json:"type"`
	Content string      `json:"content"`
	ReplyTo *string     `json:"reply_to,omitempty"`
}
