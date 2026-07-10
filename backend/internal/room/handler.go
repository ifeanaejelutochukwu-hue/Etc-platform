package room

import (
	"encoding/json"
	"net/http"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if req.Type == "" {
		req.Type = RoomTypeWatch
	}

	rm, code, err := h.svc.CreateRoom(r.Context(), userID, &req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"room": rm,
		"code": code,
	})
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")

	resp, err := h.svc.GetRoomByCode(r.Context(), code)
	if err != nil {
		http.Error(w, `{"error":"room not found"}`, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) Join(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	username, _ := r.Context().Value("username").(string)
	if username == "" {
		username = userID
	}
	code := r.PathValue("code")

	resp, err := h.svc.JoinRoom(r.Context(), code, userID, username)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) Leave(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	code := r.PathValue("code")

	rm, err := h.svc.repo.FindByCode(r.Context(), code)
	if err != nil {
		http.Error(w, `{"error":"room not found"}`, http.StatusNotFound)
		return
	}

	if err := h.svc.LeaveRoom(r.Context(), rm.ID, userID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
