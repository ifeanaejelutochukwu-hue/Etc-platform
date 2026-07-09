package chat

import (
	"context"
	"time"

	"github.com/etc/backend/internal/pkg/db"
)

type Repository struct {
	pool *db.Pool
}

func NewRepository(pool *db.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) SaveMessage(ctx context.Context, msg *Message) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO messages (id, room_id, sender_id, reply_to, type, content, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		msg.ID, msg.RoomID, msg.SenderID, msg.ReplyTo, msg.Type, msg.Content, time.Now())
	return err
}

func (r *Repository) GetMessages(ctx context.Context, roomID string, beforeID *string, limit int) ([]*Message, error) {
	query := `SELECT m.id, m.room_id, m.sender_id, u.username, m.reply_to, m.type, m.content, m.created_at
		 FROM messages m
		 JOIN users u ON u.id = m.sender_id
		 WHERE m.room_id = ?`

	var args []interface{}
	args = append(args, roomID)

	if beforeID != nil {
		query += ` AND m.id < ?`
		args = append(args, *beforeID)
	}

	query += ` ORDER BY m.created_at DESC LIMIT ?`
	args = append(args, limit)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []*Message
	for rows.Next() {
		m := &Message{}
		if err := rows.Scan(&m.ID, &m.RoomID, &m.SenderID, &m.Username, &m.ReplyTo, &m.Type, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, nil
}
