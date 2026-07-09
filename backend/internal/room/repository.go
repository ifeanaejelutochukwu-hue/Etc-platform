package room

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

func (r *Repository) Create(ctx context.Context, code string, room *Room) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO rooms (id, code, name, type, owner_id, is_active, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		room.ID, code, room.Name, room.Type, room.OwnerID, true, time.Now())
	return err
}

func (r *Repository) FindByCode(ctx context.Context, code string) (*Room, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT id, code, name, type, owner_id, is_active, created_at
		 FROM rooms WHERE code = ? AND is_active = 1`, code)
	rm := &Room{}
	err := row.Scan(&rm.ID, &rm.Code, &rm.Name, &rm.Type, &rm.OwnerID, &rm.IsActive, &rm.CreatedAt)
	if err != nil {
		return nil, err
	}
	return rm, nil
}

func (r *Repository) Deactivate(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE rooms SET is_active = 0 WHERE id = ?`, id)
	return err
}

func (r *Repository) AddParticipant(ctx context.Context, roomID, userID string, role ParticipantRole) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO room_participants (room_id, user_id, role, joined_at, is_muted)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (room_id, user_id) DO UPDATE SET role = ?`,
		roomID, userID, role, time.Now(), false,
		role)
	return err
}

func (r *Repository) RemoveParticipant(ctx context.Context, roomID, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM room_participants WHERE room_id = ? AND user_id = ?`,
		roomID, userID)
	return err
}

func (r *Repository) GetParticipants(ctx context.Context, roomID string) ([]*Participant, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT rp.user_id, u.username, rp.role, rp.is_muted, rp.joined_at
		 FROM room_participants rp
		 JOIN users u ON u.id = rp.user_id
		 WHERE rp.room_id = ?
		 ORDER BY rp.joined_at`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var participants []*Participant
	for rows.Next() {
		p := &Participant{}
		if err := rows.Scan(&p.UserID, &p.Username, &p.Role, &p.IsMuted, &p.JoinedAt); err != nil {
			return nil, err
		}
		participants = append(participants, p)
	}
	return participants, nil
}
