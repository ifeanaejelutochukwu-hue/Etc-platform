package media

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	mu    sync.RWMutex
	queues map[string]*QueueState // roomCode -> queue
}

type QueueState struct {
	Items      []*PlaylistItem
	NowPlaying *NowPlaying
	Position   int // index in Items that is current
}

func NewService() *Service {
	return &Service{
		queues: make(map[string]*QueueState),
	}
}

func (s *Service) GetQueue(roomCode string) *QueueState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.queues[roomCode]
}

func (s *Service) getOrCreate(roomCode string) *QueueState {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.queues[roomCode]; !ok {
		s.queues[roomCode] = &QueueState{
			Items:    []*PlaylistItem{},
			Position: -1,
		}
	}
	return s.queues[roomCode]
}

func (s *Service) AddItem(roomCode, sourceType, sourceURL, title, artist string, duration int, addedBy, addedName string) (*PlaylistItem, error) {
	q := s.getOrCreate(roomCode)

	item := &PlaylistItem{
		ID:         uuid.New().String(),
		RoomCode:   roomCode,
		SourceType: sourceType,
		SourceURL:  sourceURL,
		Title:      title,
		Artist:     artist,
		Duration:   duration,
		AddedBy:    addedBy,
		AddedName:  addedName,
		Position:   len(q.Items),
		CreatedAt:  time.Now(),
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	q.Items = append(q.Items, item)

	return item, nil
}

func (s *Service) RemoveItem(roomCode, itemID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	q, ok := s.queues[roomCode]
	if !ok {
		return fmt.Errorf("no queue for room")
	}

	for i, item := range q.Items {
		if item.ID == itemID {
			q.Items = append(q.Items[:i], q.Items[i+1:]...)
			if q.Position > i {
				q.Position--
			}
			return nil
		}
	}
	return fmt.Errorf("item not found")
}

func (s *Service) Skip(roomCode string) *PlaylistItem {
	s.mu.Lock()
	defer s.mu.Unlock()

	q, ok := s.queues[roomCode]
	if !ok || len(q.Items) == 0 {
		return nil
	}

	nextPos := q.Position + 1
	if nextPos >= len(q.Items) {
		q.Position = -1
		q.NowPlaying = nil
		return nil
	}

	q.Position = nextPos
	item := q.Items[nextPos]
	q.NowPlaying = &NowPlaying{
		Item:        item,
		IsPlaying:   true,
		CurrentTime: 0,
		StartedAt:   time.Now(),
	}
	return item
}

func (s *Service) PlaySpecific(roomCode string, position int) *PlaylistItem {
	s.mu.Lock()
	defer s.mu.Unlock()

	q, ok := s.queues[roomCode]
	if !ok || position < 0 || position >= len(q.Items) {
		return nil
	}

	q.Position = position
	item := q.Items[position]
	q.NowPlaying = &NowPlaying{
		Item:        item,
		IsPlaying:   true,
		CurrentTime: 0,
		StartedAt:   time.Now(),
	}
	return item
}

func (s *Service) SetNowPlayingTime(roomCode string, currentTime float64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if q, ok := s.queues[roomCode]; ok && q.NowPlaying != nil {
		q.NowPlaying.CurrentTime = currentTime
	}
}

func (s *Service) SetNowPlayingStatus(roomCode string, isPlaying bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if q, ok := s.queues[roomCode]; ok && q.NowPlaying != nil {
		q.NowPlaying.IsPlaying = isPlaying
	}
}
