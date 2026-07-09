package media

import "time"

type PlaylistItem struct {
	ID         string    `json:"id"`
	RoomCode   string    `json:"-"`
	SourceType string    `json:"source_type"`
	SourceURL  string    `json:"source_url"`
	Title      string    `json:"title"`
	Artist     string    `json:"artist,omitempty"`
	Duration   int       `json:"duration"`
	AddedBy    string    `json:"added_by"`
	AddedName  string    `json:"added_name,omitempty"`
	Position   int       `json:"position"`
	CreatedAt  time.Time `json:"created_at"`
}

type NowPlaying struct {
	Item        *PlaylistItem `json:"item"`
	IsPlaying   bool          `json:"is_playing"`
	CurrentTime float64       `json:"current_time"`
	StartedAt   time.Time     `json:"started_at,omitempty"`
}
