package dm

import (
	"context"
	"database/sql"
	"time"

	"github.com/etc/backend/internal/pkg/db"
	"github.com/google/uuid"
)

type Repository struct{ pool *db.Pool }

func NewRepository(pool *db.Pool) *Repository { return &Repository{pool: pool} }

// GetOrCreateDirect returns an existing direct conversation between two users,
// or creates one if it doesn't exist.
func (r *Repository) GetOrCreateDirect(ctx context.Context, userA, userB string) (*Conversation, error) {
	// Look for an existing direct conversation containing both users.
	row := r.pool.QueryRow(ctx, `
		SELECT c.id FROM conversations c
		JOIN conversation_members ma ON ma.conversation_id = c.id AND ma.user_id = ?
		JOIN conversation_members mb ON mb.conversation_id = c.id AND mb.user_id = ?
		WHERE c.type = 'direct' LIMIT 1`, userA, userB)
	var convID string
	if err := row.Scan(&convID); err == nil {
		return r.GetConversation(ctx, convID, userA)
	}
	// Create fresh conversation.
	convID = uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := r.pool.Exec(ctx,
		`INSERT INTO conversations (id, type, created_by, created_at) VALUES (?, 'direct', ?, ?)`,
		convID, userA, now)
	if err != nil { return nil, err }
	for _, uid := range []string{userA, userB} {
		r.pool.Exec(ctx,
			`INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)`,
			convID, uid, now)
	}
	return r.GetConversation(ctx, convID, userA)
}

// CreateGroup creates a named group conversation.
func (r *Repository) CreateGroup(ctx context.Context, name, createdBy string, memberIDs []string) (*Conversation, error) {
	convID := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := r.pool.Exec(ctx,
		`INSERT INTO conversations (id, type, name, created_by, created_at) VALUES (?, 'group', ?, ?, ?)`,
		convID, name, createdBy, now)
	if err != nil { return nil, err }
	// Always include creator.
	all := append([]string{createdBy}, memberIDs...)
	seen := map[string]bool{}
	for _, uid := range all {
		if seen[uid] { continue }
		seen[uid] = true
		r.pool.Exec(ctx,
			`INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)`,
			convID, uid, now)
	}
	return r.GetConversation(ctx, convID, createdBy)
}

// GetConversation fetches a single conversation with its members.
func (r *Repository) GetConversation(ctx context.Context, convID, viewerID string) (*Conversation, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, type, COALESCE(name,''), created_by, created_at FROM conversations WHERE id=?`, convID)
	c := &Conversation{}
	var createdStr string
	if err := row.Scan(&c.ID, &c.Type, &c.Name, &c.CreatedBy, &createdStr); err != nil {
		return nil, err
	}
	c.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdStr)
	c.Members, _ = r.getMembers(ctx, convID)
	c.LastMessage, _ = r.getLastMessage(ctx, convID)
	return c, nil
}

// ListConversations returns all conversations for a user, newest first.
func (r *Repository) ListConversations(ctx context.Context, userID string) ([]*Conversation, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.type, COALESCE(c.name,''), c.created_by, c.created_at
		FROM conversations c
		JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
		ORDER BY c.created_at DESC`, userID)
	if err != nil { return nil, err }
	defer rows.Close()
	var convs []*Conversation
	for rows.Next() {
		c := &Conversation{}
		var createdStr string
		if err := rows.Scan(&c.ID, &c.Type, &c.Name, &c.CreatedBy, &createdStr); err != nil { return nil, err }
		c.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdStr)
		c.Members, _ = r.getMembers(ctx, c.ID)
		c.LastMessage, _ = r.getLastMessage(ctx, c.ID)
		convs = append(convs, c)
	}
	return convs, nil
}

// SendMessage inserts a direct message.
func (r *Repository) SendMessage(ctx context.Context, convID, senderID, content, msgType string) (*Message, error) {
	id := uuid.New().String()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := r.pool.Exec(ctx,
		`INSERT INTO direct_messages (id, conversation_id, sender_id, content, msg_type, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		id, convID, senderID, content, msgType, now)
	if err != nil { return nil, err }
	return r.getMessage(ctx, id)
}

// GetMessages returns the last N messages in a conversation.
func (r *Repository) GetMessages(ctx context.Context, convID string, limit int) ([]*Message, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT dm.id, dm.conversation_id, dm.sender_id, u.username,
		       dm.content, dm.msg_type, dm.created_at
		FROM direct_messages dm
		JOIN users u ON u.id = dm.sender_id
		WHERE dm.conversation_id = ?
		ORDER BY dm.created_at ASC LIMIT ?`, convID, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var msgs []*Message
	for rows.Next() {
		m := &Message{}
		var createdStr string
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderUsername,
			&m.Content, &m.MsgType, &createdStr); err != nil { return nil, err }
		m.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdStr)
		msgs = append(msgs, m)
	}
	return msgs, nil
}

// IsMember checks whether a user belongs to a conversation.
func (r *Repository) IsMember(ctx context.Context, convID, userID string) bool {
	var count int
	r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM conversation_members WHERE conversation_id=? AND user_id=?`,
		convID, userID).Scan(&count)
	return count > 0
}

// GetConversationMembers returns just the user IDs in a conversation.
func (r *Repository) GetConversationMembers(ctx context.Context, convID string) ([]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT user_id FROM conversation_members WHERE conversation_id=?`, convID)
	if err != nil { return nil, err }
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		rows.Scan(&id)
		ids = append(ids, id)
	}
	return ids, nil
}

func (r *Repository) getMembers(ctx context.Context, convID string) ([]Member, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cm.user_id, u.username, COALESCE(u.display_name,''), COALESCE(u.avatar_url,''), cm.joined_at
		FROM conversation_members cm JOIN users u ON u.id=cm.user_id
		WHERE cm.conversation_id=?`, convID)
	if err != nil { return nil, err }
	defer rows.Close()
	var members []Member
	for rows.Next() {
		m := Member{}
		var joinedStr string
		if err := rows.Scan(&m.UserID, &m.Username, &m.DisplayName, &m.AvatarURL, &joinedStr); err != nil { return nil, err }
		m.JoinedAt, _ = time.Parse(time.RFC3339Nano, joinedStr)
		members = append(members, m)
	}
	return members, nil
}

func (r *Repository) getLastMessage(ctx context.Context, convID string) (*Message, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT dm.id, dm.conversation_id, dm.sender_id, u.username, dm.content, dm.msg_type, dm.created_at
		FROM direct_messages dm JOIN users u ON u.id=dm.sender_id
		WHERE dm.conversation_id=? ORDER BY dm.created_at DESC LIMIT 1`, convID)
	m := &Message{}
	var createdStr string
	err := row.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderUsername,
		&m.Content, &m.MsgType, &createdStr)
	if err == sql.ErrNoRows { return nil, nil }
	if err != nil { return nil, err }
	m.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdStr)
	return m, nil
}

func (r *Repository) getMessage(ctx context.Context, id string) (*Message, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT dm.id, dm.conversation_id, dm.sender_id, u.username, dm.content, dm.msg_type, dm.created_at
		FROM direct_messages dm JOIN users u ON u.id=dm.sender_id WHERE dm.id=?`, id)
	m := &Message{}
	var createdStr string
	if err := row.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderUsername,
		&m.Content, &m.MsgType, &createdStr); err != nil { return nil, err }
	m.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdStr)
	return m, nil
}
