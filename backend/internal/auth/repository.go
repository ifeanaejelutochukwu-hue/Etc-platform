package auth

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

func (r *Repository) SaveOTP(ctx context.Context, phone, code string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO otp_codes (phone, code, expires_at, created_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (phone) DO UPDATE SET code = $2, expires_at = $3, created_at = NOW()`,
		phone, code, expiresAt)
	return err
}

func (r *Repository) VerifyOTP(ctx context.Context, phone, code string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM otp_codes
			WHERE phone = $1 AND code = $2 AND expires_at > NOW()
		)`, phone, code).Scan(&exists)
	return exists, err
}

func (r *Repository) DeleteOTP(ctx context.Context, phone string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM otp_codes WHERE phone = $1`, phone)
	return err
}

func (r *Repository) FindUserByPhone(ctx context.Context, phone string) (*UserRow, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, phone, username, display_name, avatar_url, created_at
		 FROM users WHERE phone = $1`, phone)
	u := &UserRow{}
	err := row.Scan(&u.ID, &u.Phone, &u.Username, &u.DisplayName, &u.AvatarURL, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *Repository) CreateUser(ctx context.Context, phone, username string) (*UserRow, error) {
	row := r.pool.QueryRow(ctx,
		`INSERT INTO users (phone, username, display_name, created_at)
		 VALUES ($1, $2, $2, NOW())
		 RETURNING id, phone, username, display_name, avatar_url, created_at`,
		phone, username)
	u := &UserRow{}
	err := row.Scan(&u.ID, &u.Phone, &u.Username, &u.DisplayName, &u.AvatarURL, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

type UserRow struct {
	ID          string
	Phone       string
	Username    string
	DisplayName *string
	AvatarURL   *string
	CreatedAt   time.Time
}
