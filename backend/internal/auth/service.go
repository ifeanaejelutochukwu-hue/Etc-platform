package auth

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo      *Repository
	jwtSecret string
}

func NewService(repo *Repository, jwtSecret string) *Service {
	return &Service{repo: repo, jwtSecret: jwtSecret}
}

// Register creates a new account. Returns an error if the username is taken.
func (s *Service) Register(ctx context.Context, username, password string) (*AuthResponse, error) {
	username = strings.TrimSpace(username)
	if len(username) < 3 {
		return nil, fmt.Errorf("username must be at least 3 characters")
	}
	if len(password) < 6 {
		return nil, fmt.Errorf("password must be at least 6 characters")
	}

	// Check username not already taken
	existing, err := s.repo.FindByUsername(ctx, username)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("database error")
	}
	if existing != nil {
		return nil, fmt.Errorf("username already taken")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("could not hash password")
	}

	user, err := s.repo.CreateUser(ctx, username, string(hash))
	if err != nil {
		return nil, fmt.Errorf("could not create user: %w", err)
	}

	return s.buildResponse(user)
}

// Login verifies credentials and returns a signed JWT on success.
func (s *Service) Login(ctx context.Context, username, password string) (*AuthResponse, error) {
	user, err := s.repo.FindByUsername(ctx, strings.TrimSpace(username))
	if err == sql.ErrNoRows {
		// Use a generic message — don't reveal which field was wrong
		return nil, fmt.Errorf("invalid username or password")
	}
	if err != nil {
		return nil, fmt.Errorf("database error")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid username or password")
	}

	return s.buildResponse(user)
}

func (s *Service) buildResponse(user *UserRow) (*AuthResponse, error) {
	token, err := GenerateToken(user.ID, "", user.Username, s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("could not sign token")
	}
	return &AuthResponse{
		Token: token,
		User: UserDTO{
			ID:          user.ID,
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
