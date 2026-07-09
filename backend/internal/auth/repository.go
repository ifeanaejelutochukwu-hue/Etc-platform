package auth

import (
	"context"
	"time"

	"github.com/etc/backend/internal/pkg/db"
	"github.com/google/uuid"
)

type Repository struct {
	pool *db.Pool
}

func NewRepository(pool *db.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) SaveOTP(ctx context.Context, phone, code string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO otp_codes (phone, code, expires_at, created_at)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT (phone) DO UPDATE SET code = ?, expires_at = ?, created_at = ?`,
		phone, code, expiresAt, time.Now(),
		code, expiresAt, time.Now())
	return err
}

func (r *Repository) VerifyOTP(ctx context.Context, phone, code string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) > 0 FROM otp_codes
		 WHERE phone = ? AND code = ? AND expires_at > ?`,
		phone, code, time.Now()).Scan(&exists)
	return exists, err
}

func (r *Repository) DeleteOTP(ctx context.Context, phone string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM otp_codes WHERE phone = ?`, phone)
	return err
}

func (r *Repository) FindUserByPhone(ctx context.Context, phone string) (*UserRow, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, phone, username, display_name, avatar_url, created_at
		 FROM users WHERE phone = ?`, phone)
	u := &UserRow{}
	err := row.Scan(&u.ID, &u.Phone, &u.Username, &u.DisplayName, &u.AvatarURL, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *Repository) CreateUser(ctx context.Context, phone, username string) (*UserRow, error) {
	id := uuid.New().String()
	now := time.Now()
	_, err := r.pool.Exec(ctx,
		`INSERT INTO users (id, phone, username, display_name, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		id, phone, username, username, now)
	if err != nil {
		return nil, err
	}
	return &UserRow{
		ID:        id,
		Phone:     phone,
		Username:  username,
		CreatedAt: now,
	}, nil
}

type UserRow struct {
	ID          string
	Phone       string
	Username    string
	DisplayName *string
	AvatarURL   *string
	CreatedAt   time.Time
}
