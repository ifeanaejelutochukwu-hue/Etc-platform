package room

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/etc/backend/internal/call"
)

type Service struct {
	repo      *Repository
	roomHub   *RoomHub
	callSvc   *call.Service
}

func NewService(repo *Repository, roomHub *RoomHub, callSvc *call.Service) *Service {
	return &Service{repo: repo, roomHub: roomHub, callSvc: callSvc}
}

func generateCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 6)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

func (s *Service) CreateRoom(ctx context.Context, userID string, req *CreateRoomRequest) (*Room, string, error) {
	code := generateCode()
	rm := &Room{
		ID:        uuid.New().String(),
		Code:      code,
		Name:      req.Name,
		Type:      req.Type,
		OwnerID:   userID,
		IsActive:  true,
		CreatedAt: time.Now(),
	}

	if err := s.repo.Create(ctx, code, rm); err != nil {
		return nil, "", fmt.Errorf("create room: %w", err)
	}

	if err := s.repo.AddParticipant(ctx, rm.ID, userID, RoleHost); err != nil {
		return nil, "", fmt.Errorf("add host: %w", err)
	}

	s.roomHub.CreateRoom(rm)

	if s.callSvc != nil {
		s.callSvc.CreateRoom(rm.ID)
	}

	return rm, code, nil
}

func (s *Service) JoinRoom(ctx context.Context, code, userID, username string) (*JoinRoomResponse, error) {
	rm, err := s.repo.FindByCode(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("room not found")
	}

	if err := s.repo.AddParticipant(ctx, rm.ID, userID, RoleMember); err != nil {
		return nil, fmt.Errorf("join room: %w", err)
	}

	participants, err := s.repo.GetParticipants(ctx, rm.ID)
	if err != nil {
		return nil, err
	}

	resp := &JoinRoomResponse{
		Room:         rm,
		Participants: participants,
	}

	if s.callSvc != nil {
		token, err := s.callSvc.GenerateToken(userID, rm.ID, true)
		if err == nil {
			resp.LiveKitToken = token
		}
	}

	return resp, nil
}

func (s *Service) LeaveRoom(ctx context.Context, roomID, userID string) error {
	if err := s.repo.RemoveParticipant(ctx, roomID, userID); err != nil {
		return err
	}

	participants, err := s.repo.GetParticipants(ctx, roomID)
	if err != nil {
		return err
	}

	if len(participants) == 0 {
		s.repo.Deactivate(ctx, roomID)
		if s.callSvc != nil {
			s.callSvc.CloseRoom(roomID)
		}
	}

	return nil
}

func (s *Service) GetRoomByCode(ctx context.Context, code string) (*JoinRoomResponse, error) {
	rm, err := s.repo.FindByCode(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("room not found")
	}

	participants, err := s.repo.GetParticipants(ctx, rm.ID)
	if err != nil {
		return nil, err
	}

	return &JoinRoomResponse{
		Room:         rm,
		Participants: participants,
	}, nil
}
