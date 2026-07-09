package chat

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) SaveMessage(ctx context.Context, roomID, senderID, username, content string) (*Message, error) {
	msg := &Message{
		ID:        uuid.New().String(),
		RoomID:    roomID,
		SenderID:  senderID,
		Username:  username,
		Type:      MsgText,
		Content:   content,
		CreatedAt: time.Now(),
	}
	if err := s.repo.SaveMessage(ctx, msg); err != nil {
		return nil, err
	}
	return msg, nil
}

func (s *Service) GetHistory(ctx context.Context, roomID string, beforeID *string, limit int) ([]*Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return s.repo.GetMessages(ctx, roomID, beforeID, limit)
}
