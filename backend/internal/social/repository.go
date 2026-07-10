package social

import (
	"context"
	"database/sql"
	"time"

	"github.com/etc/backend/internal/pkg/db"
	"github.com/google/uuid"
)

type Repository struct{ pool *db.Pool }

func NewRepository(pool *db.Pool) *Repository { return &Repository{pool: pool} }

// SearchUsers finds users whose username contains the query (excluding self).
func (r *Repository) SearchUsers(ctx context.Context, query, selfID string) ([]*UserProfile, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, username, display_name, avatar_url, bio FROM users
		 WHERE username LIKE ? AND id != ? LIMIT 30`,
		"%"+query+"%", selfID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*UserProfile
	for rows.Next() {
		u := &UserProfile{}
		var dn, av, bio sql.NullString
		if err := rows.Scan(&u.ID, &u.Username, &dn, &av, &bio); err != nil {
			return nil, err
		}
		u.DisplayName = dn.String; u.AvatarURL = av.String; u.Bio = bio.String
		out = append(out, u)
	}
	return out, nil
}

// GetProfile returns a single user profile with friendship status relative to viewer.
func (r *Repository) GetProfile(ctx context.Context, targetID, viewerID string) (*UserProfile, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, username, display_name, avatar_url, bio FROM users WHERE id = ?`, targetID)
	u := &UserProfile{}
	var dn, av, bio sql.NullString
	if err := row.Scan(&u.ID, &u.Username, &dn, &av, &bio); err != nil {
		return nil, err
	}
	u.DisplayName = dn.String; u.AvatarURL = av.String; u.Bio = bio.String
	// Friendship status
	var status sql.NullString
	var req sql.NullString
	r.pool.QueryRow(ctx,
		`SELECT status, requester_id FROM friendships
		 WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)`,
		viewerID, targetID, targetID, viewerID).Scan(&status, &req)
	if status.Valid {
		switch FriendshipStatus(status.String) {
		case StatusAccepted:
			u.IsFriend = true
		case StatusPending:
			if req.String == viewerID { u.IsPending = true } else { u.IsIncoming = true }
		}
	}
	return u, nil
}

// SendFriendRequest creates a pending friendship record.
func (r *Repository) SendFriendRequest(ctx context.Context, requesterID, addresseeID string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT OR IGNORE INTO friendships (id, requester_id, addressee_id, status, created_at)
		 VALUES (?, ?, ?, 'pending', ?)`,
		uuid.New().String(), requesterID, addresseeID, time.Now().UTC().Format(time.RFC3339Nano))
	return err
}

// UpdateFriendship changes status to accepted or declined.
func (r *Repository) UpdateFriendship(ctx context.Context, addresseeID, requesterID string, status FriendshipStatus) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE friendships SET status=? WHERE requester_id=? AND addressee_id=? AND status='pending'`,
		string(status), requesterID, addresseeID)
	return err
}

// ListFriends returns accepted friends for a user.
func (r *Repository) ListFriends(ctx context.Context, userID string) ([]*UserProfile, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
		 FROM friendships f
		 JOIN users u ON u.id = CASE WHEN f.requester_id=? THEN f.addressee_id ELSE f.requester_id END
		 WHERE (f.requester_id=? OR f.addressee_id=?) AND f.status='accepted'`,
		userID, userID, userID)
	if err != nil { return nil, err }
	defer rows.Close()
	return scanProfiles(rows, true)
}

// ListPendingIncoming returns pending requests sent TO the user.
func (r *Repository) ListPendingIncoming(ctx context.Context, userID string) ([]*FriendRequest, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT f.id, u.id, u.username, u.display_name, u.avatar_url, u.bio, f.created_at
		 FROM friendships f
		 JOIN users u ON u.id = f.requester_id
		 WHERE f.addressee_id=? AND f.status='pending'
		 ORDER BY f.created_at DESC`, userID)
	if err != nil { return nil, err }
	defer rows.Close()
	var out []*FriendRequest
	for rows.Next() {
		fr := &FriendRequest{User: UserProfile{IsIncoming: true}}
		var dn, av, bio sql.NullString
		var createdStr string
		if err := rows.Scan(&fr.ID, &fr.User.ID, &fr.User.Username, &dn, &av, &bio, &createdStr); err != nil {
			return nil, err
		}
		fr.User.DisplayName = dn.String; fr.User.AvatarURL = av.String; fr.User.Bio = bio.String
		fr.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdStr)
		out = append(out, fr)
	}
	return out, nil
}

// UpdateBio sets a user's bio.
func (r *Repository) UpdateBio(ctx context.Context, userID, bio string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET bio=? WHERE id=?`, bio, userID)
	return err
}

// GetActiveRooms returns rooms that are currently active (for discover feed).
func (r *Repository) GetActiveRooms(ctx context.Context, limit int) ([]map[string]interface{}, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT r.id, r.code, r.name, r.type, r.owner_id, u.username,
		        (SELECT COUNT(*) FROM room_participants rp WHERE rp.room_id=r.id) as member_count
		 FROM rooms r JOIN users u ON u.id=r.owner_id
		 WHERE r.is_active=1 ORDER BY member_count DESC LIMIT ?`, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var id, code, name, rtype, ownerID, ownerName string
		var count int
		if err := rows.Scan(&id, &code, &name, &rtype, &ownerID, &ownerName, &count); err != nil { return nil, err }
		out = append(out, map[string]interface{}{
			"id": id, "code": code, "name": name, "type": rtype,
			"owner_id": ownerID, "owner_username": ownerName, "member_count": count,
		})
	}
	return out, nil
}

func scanProfiles(rows interface{ Next() bool; Scan(...interface{}) error; Close() error }, friend bool) ([]*UserProfile, error) {
	defer rows.Close()
	var out []*UserProfile
	for rows.Next() {
		u := &UserProfile{IsFriend: friend}
		var dn, av, bio sql.NullString
		if err := rows.Scan(&u.ID, &u.Username, &dn, &av, &bio); err != nil { return nil, err }
		u.DisplayName = dn.String; u.AvatarURL = av.String; u.Bio = bio.String
		out = append(out, u)
	}
	return out, nil
}
