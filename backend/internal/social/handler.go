package social

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct{ repo *Repository }

func NewHandler(repo *Repository) *Handler { return &Handler{repo: repo} }

func userIDFrom(r *http.Request) string {
	v, _ := r.Context().Value("user_id").(string)
	return v
}

func jsonOK(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// GET /api/users/search?q=...
func (h *Handler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if len(q) < 1 { jsonErr(w, "query required", 400); return }
	users, err := h.repo.SearchUsers(r.Context(), q, userIDFrom(r))
	if err != nil { jsonErr(w, "search failed", 500); return }
	jsonOK(w, users)
}

// GET /api/users/:id
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "id")
	profile, err := h.repo.GetProfile(r.Context(), targetID, userIDFrom(r))
	if err != nil { jsonErr(w, "user not found", 404); return }
	jsonOK(w, profile)
}

// GET /api/me/profile
func (h *Handler) GetMyProfile(w http.ResponseWriter, r *http.Request) {
	id := userIDFrom(r)
	profile, err := h.repo.GetProfile(r.Context(), id, id)
	if err != nil { jsonErr(w, "not found", 404); return }
	jsonOK(w, profile)
}

// PATCH /api/me/bio
func (h *Handler) UpdateBio(w http.ResponseWriter, r *http.Request) {
	var body struct{ Bio string `json:"bio"` }
	json.NewDecoder(r.Body).Decode(&body)
	if err := h.repo.UpdateBio(r.Context(), userIDFrom(r), body.Bio); err != nil {
		jsonErr(w, "update failed", 500); return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

// POST /api/friends/request/:id
func (h *Handler) SendRequest(w http.ResponseWriter, r *http.Request) {
	addresseeID := chi.URLParam(r, "id")
	me := userIDFrom(r)
	if me == addresseeID { jsonErr(w, "cannot add yourself", 400); return }
	if err := h.repo.SendFriendRequest(r.Context(), me, addresseeID); err != nil {
		jsonErr(w, "request failed", 500); return
	}
	w.WriteHeader(201)
	jsonOK(w, map[string]string{"status": "pending"})
}

// POST /api/friends/accept/:id  (id = requester user id)
func (h *Handler) AcceptRequest(w http.ResponseWriter, r *http.Request) {
	requesterID := chi.URLParam(r, "id")
	if err := h.repo.UpdateFriendship(r.Context(), userIDFrom(r), requesterID, StatusAccepted); err != nil {
		jsonErr(w, "accept failed", 500); return
	}
	jsonOK(w, map[string]string{"status": "accepted"})
}

// POST /api/friends/decline/:id
func (h *Handler) DeclineRequest(w http.ResponseWriter, r *http.Request) {
	requesterID := chi.URLParam(r, "id")
	if err := h.repo.UpdateFriendship(r.Context(), userIDFrom(r), requesterID, StatusDeclined); err != nil {
		jsonErr(w, "decline failed", 500); return
	}
	jsonOK(w, map[string]string{"status": "declined"})
}

// GET /api/friends
func (h *Handler) ListFriends(w http.ResponseWriter, r *http.Request) {
	friends, err := h.repo.ListFriends(r.Context(), userIDFrom(r))
	if err != nil { jsonErr(w, "failed", 500); return }
	if friends == nil { friends = []*UserProfile{} }
	jsonOK(w, friends)
}

// GET /api/friends/pending
func (h *Handler) ListPending(w http.ResponseWriter, r *http.Request) {
	pending, err := h.repo.ListPendingIncoming(r.Context(), userIDFrom(r))
	if err != nil { jsonErr(w, "failed", 500); return }
	if pending == nil { pending = []*FriendRequest{} }
	jsonOK(w, pending)
}

// GET /api/discover
func (h *Handler) Discover(w http.ResponseWriter, r *http.Request) {
	rooms, err := h.repo.GetActiveRooms(r.Context(), 30)
	if err != nil { jsonErr(w, "failed", 500); return }
	if rooms == nil { rooms = []map[string]interface{}{} }
	jsonOK(w, rooms)
}
