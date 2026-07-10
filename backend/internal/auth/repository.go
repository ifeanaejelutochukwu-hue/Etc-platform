package auth

import (
	"context"
	"time"

	"github.com/etc/backend/internal/pkg/db"
	"github.com/google/uuid"
)

// timeLayouts are tried in order when parsing created_at from SQLite TEXT.
var timeLayouts = []string{
	time.RFC3339Nano,
	time.RFC3339,
	"2006-01-02T15:04:05.999999999Z07:00",
	"2006-01-02 15:04:05.999999999-07:00",
	"2006-01-02 15:04:05",
}

type Repository struct {
	pool *db.Pool
}

func NewRepository(pool *db.Pool) *Repository {
	return &Repository{pool: pool}
}

// FindByUsername returns a UserRow by username, or (nil, sql.ErrNoRows) if not found.
func (r *Repository) FindByUsername(ctx context.Context, username string) (*UserRow, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, username, password_hash, display_name, avatar_url, created_at
		 FROM users WHERE username = ?`, username)
	u := &UserRow{}
	var createdAtStr string
	err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.DisplayName, &u.AvatarURL, &createdAtStr)
	if err != nil {
		return nil, err
	}
	// Parse the TEXT timestamp stored by SQLite.
	for _, layout := range timeLayouts {
		if t, err := time.Parse(layout, createdAtStr); err == nil {
			u.CreatedAt = t
			break
		}
	}
	return u, nil
}

// CreateUser inserts a new user with an already-hashed password.
func (r *Repository) CreateUser(ctx context.Context, username, passwordHash string) (*UserRow, error) {
	id := uuid.New().String()
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339Nano)
	_, err := r.pool.Exec(ctx,
		`INSERT INTO users (id, username, password_hash, display_name, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		id, username, passwordHash, username, nowStr)
	if err != nil {
		return nil, err
	}
	return &UserRow{
		ID:           id,
		Username:     username,
		PasswordHash: passwordHash,
		CreatedAt:    now,
	}, nil
}

// UserRow is the internal DB representation of a user.
type UserRow struct {
	ID           string
	Username     string
	PasswordHash string
	DisplayName  *string
	AvatarURL    *string
	CreatedAt    time.Time
}
