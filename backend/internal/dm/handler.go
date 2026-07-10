package dm

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/etc/backend/internal/pkg/ws"
)

type Handler struct {
	repo *Repository
	hub  *ws.Hub
}

func NewHandler(repo *Repository, hub *ws.Hub) *Handler { return &Handler{repo: repo, hub: hub} }

func uid(r *http.Request) string { v, _ := r.Context().Value("user_id").(string); return v }

func ok(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// POST /api/dm/direct/:userID  — get or create a 1-to-1 conversation
func (h *Handler) GetOrCreateDirect(w http.ResponseWriter, r *http.Request) {
	other := chi.URLParam(r, "userID")
	me := uid(r)
	if other == me { fail(w, "cannot DM yourself", 400); return }
	conv, err := h.repo.GetOrCreateDirect(r.Context(), me, other)
	if err != nil { fail(w, "failed", 500); return }
	ok(w, conv)
}

// POST /api/dm/group  — create a group conversation
func (h *Handler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string   `json:"name"`
		Members []string `json:"members"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Name == "" { fail(w, "name required", 400); return }
	conv, err := h.repo.CreateGroup(r.Context(), body.Name, uid(r), body.Members)
	if err != nil { fail(w, "failed", 500); return }
	w.WriteHeader(201)
	ok(w, conv)
}

// GET /api/dm/conversations  — list all conversations for current user
func (h *Handler) ListConversations(w http.ResponseWriter, r *http.Request) {
	convs, err := h.repo.ListConversations(r.Context(), uid(r))
	if err != nil { fail(w, "failed", 500); return }
	if convs == nil { convs = []*Conversation{} }
	ok(w, convs)
}

// GET /api/dm/conversations/:id/messages
func (h *Handler) GetMessages(w http.ResponseWriter, r *http.Request) {
	convID := chi.URLParam(r, "id")
	if !h.repo.IsMember(r.Context(), convID, uid(r)) {
		fail(w, "forbidden", 403); return
	}
	msgs, err := h.repo.GetMessages(r.Context(), convID, 100)
	if err != nil { fail(w, "failed", 500); return }
	if msgs == nil { msgs = []*Message{} }
	ok(w, msgs)
}

// POST /api/dm/conversations/:id/messages
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	convID := chi.URLParam(r, "id")
	me := uid(r)
	if !h.repo.IsMember(r.Context(), convID, me) {
		fail(w, "forbidden", 403); return
	}
	var body struct {
		Content string `json:"content"`
		MsgType string `json:"msg_type"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Content == "" { fail(w, "content required", 400); return }
	if body.MsgType == "" { body.MsgType = "text" }

	msg, err := h.repo.SendMessage(r.Context(), convID, me, body.Content, body.MsgType)
	if err != nil { fail(w, "failed", 500); return }

	// Push to all conversation members via WebSocket.
	if h.hub != nil {
		members, _ := h.repo.GetConversationMembers(r.Context(), convID)
		wsMsg, _ := ws.NewMessage("dm.message", msg)
		for _, memberID := range members {
			h.hub.SendToUser(memberID, wsMsg)
		}
	}

	w.WriteHeader(201)
	ok(w, msg)
}

// GET /api/dm/conversations/:id
func (h *Handler) GetConversation(w http.ResponseWriter, r *http.Request) {
	convID := chi.URLParam(r, "id")
	me := uid(r)
	if !h.repo.IsMember(r.Context(), convID, me) {
		fail(w, "forbidden", 403); return
	}
	conv, err := h.repo.GetConversation(r.Context(), convID, me)
	if err != nil { fail(w, "not found", 404); return }
	ok(w, conv)
}
