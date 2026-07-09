package auth

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"time"
)

type Service struct {
	repo      *Repository
	jwtSecret string
}

func NewService(repo *Repository, jwtSecret string) *Service {
	return &Service{repo: repo, jwtSecret: jwtSecret}
}

func generateOTP() string {
	return fmt.Sprintf("%06d", rand.Intn(1000000))
}

func (s *Service) RequestOTP(ctx context.Context, phone string) error {
	code := generateOTP()
	expiresAt := time.Now().Add(5 * time.Minute)
	return s.repo.SaveOTP(ctx, phone, code, expiresAt)
}

func (s *Service) VerifyOTP(ctx context.Context, phone, code string) (*AuthResponse, error) {
	valid, err := s.repo.VerifyOTP(ctx, phone, code)
	if err != nil {
		return nil, err
	}
	if !valid {
		return nil, fmt.Errorf("invalid or expired OTP")
	}

	if err := s.repo.DeleteOTP(ctx, phone); err != nil {
		return nil, err
	}

	user, err := s.repo.FindUserByPhone(ctx, phone)
	if err == sql.ErrNoRows {
		username := "user_" + phone[len(phone)-4:]
		user, err = s.repo.CreateUser(ctx, phone, username)
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	token, err := GenerateToken(user.ID, phone, user.Username, s.jwtSecret)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		User: UserDTO{
			ID:          user.ID,
			Phone:       user.Phone,
			Username:    user.Username,
			DisplayName: safeStr(user.DisplayName),
			AvatarURL:   safeStr(user.AvatarURL),
		},
	}, nil
}

func safeStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
