package room

import (
	"context"
	"encoding/json"
	"log"

	"github.com/etc/backend/internal/chat"
	"github.com/etc/backend/internal/media"
	"github.com/etc/backend/internal/pkg/ws"
)

type WSHandler struct {
	svc       *Service
	hub       *ws.Hub
	roomHub   *RoomHub
	chatSvc   *chat.Service
	roomRepo  *Repository
	mediaSvc  *media.Service
}

func NewWSHandler(svc *Service, hub *ws.Hub, roomHub *RoomHub, chatSvc *chat.Service, roomRepo *Repository, mediaSvc *media.Service) *WSHandler {
	return &WSHandler{svc: svc, hub: hub, roomHub: roomHub, chatSvc: chatSvc, roomRepo: roomRepo, mediaSvc: mediaSvc}
}

func (h *WSHandler) HandleMessage(client *ws.Client, msg ws.Message) {
	switch msg.Type {
	case "room.join":
		h.handleJoin(client, msg)
	case "room.leave":
		h.handleLeave(client)
	case "media.play":
		h.handleMediaPlay(client, msg)
	case "media.pause":
		h.handleMediaPause(client, msg)
	case "media.seek":
		h.handleMediaSeek(client, msg)
	case "media.change":
		h.handleMediaChange(client, msg)
	case "chat.send":
		h.handleChatSend(client, msg)
	case "chat.typing":
		h.handleTyping(client, msg)
	case "playlist.add":
		h.handlePlaylistAdd(client, msg)
	case "playlist.remove":
		h.handlePlaylistRemove(client, msg)
	case "playlist.skip":
		h.handlePlaylistSkip(client, msg)
	case "playlist.play":
		h.handlePlaylistPlay(client, msg)
	case "call.mute":
		h.handleMute(client, msg)
	case "call.speaking":
		h.handleSpeaking(client, msg)
	default:
		log.Printf("unknown message type: %s", msg.Type)
	}
}

type JoinPayload struct {
	RoomCode string `json:"room_code"`
}

func (h *WSHandler) handleJoin(client *ws.Client, msg ws.Message) {
	var payload JoinPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		sendError(client, "invalid_payload", "invalid join payload")
		return
	}

	resp, err := h.svc.JoinRoom(context.Background(), payload.RoomCode, client.UserID, client.Username)
	if err != nil {
		sendError(client, "join_failed", err.Error())
		return
	}

	h.hub.AddToRoom(client, payload.RoomCode)

	joinedMsg, _ := ws.NewMessage("room.joined", resp)
	client.Send <- joinedMsg

	if h.chatSvc != nil && resp.Room != nil {
		history, _ := h.chatSvc.GetHistory(context.Background(), resp.Room.ID, nil, 50)
		if history != nil {
			histMsg, _ := ws.NewMessage("chat.history", history)
			client.Send <- histMsg
		}
	}

	broadcastMsg, _ := ws.NewMessage("room.participant_joined", map[string]interface{}{
		"user_id":  client.UserID,
		"username": client.Username,
	})
	h.hub.BroadcastToRoom(payload.RoomCode, broadcastMsg, client.ID)
}

func (h *WSHandler) handleLeave(client *ws.Client) {
	roomCode := client.RoomCode
	if roomCode == "" {
		return
	}

	h.hub.RemoveFromRoom(client)

	leftMsg, _ := ws.NewMessage("room.participant_left", map[string]string{
		"user_id": client.UserID,
	})
	h.hub.BroadcastToRoom(roomCode, leftMsg)
}

func (h *WSHandler) handleMediaPlay(client *ws.Client, msg ws.Message) {
	var payload struct {
		CurrentTime float64 `json:"current_time"`
	}
	json.Unmarshal(msg.Payload, &payload)

	if rs, ok := h.roomHub.GetRoom(client.RoomCode); ok {
		rs.Mu.Lock()
		rs.Media.IsPlaying = true
		rs.Media.CurrentTime = payload.CurrentTime
		rs.Mu.Unlock()
	}

	broadcast, _ := ws.NewMessage("media.play", payload)
	h.hub.BroadcastToRoom(client.RoomCode, broadcast, client.ID)
}

func (h *WSHandler) handleMediaPause(client *ws.Client, msg ws.Message) {
	var payload struct {
		CurrentTime float64 `json:"current_time"`
	}
	json.Unmarshal(msg.Payload, &payload)

	if rs, ok := h.roomHub.GetRoom(client.RoomCode); ok {
		rs.Mu.Lock()
		rs.Media.IsPlaying = false
		rs.Media.CurrentTime = payload.CurrentTime
		rs.Mu.Unlock()
	}

	broadcast, _ := ws.NewMessage("media.pause", payload)
	h.hub.BroadcastToRoom(client.RoomCode, broadcast, client.ID)
}

func (h *WSHandler) handleMediaSeek(client *ws.Client, msg ws.Message) {
	var payload struct {
		CurrentTime float64 `json:"current_time"`
	}
	json.Unmarshal(msg.Payload, &payload)

	if rs, ok := h.roomHub.GetRoom(client.RoomCode); ok {
		rs.Mu.Lock()
		rs.Media.CurrentTime = payload.CurrentTime
		rs.Mu.Unlock()
	}

	broadcast, _ := ws.NewMessage("media.seek", payload)
	h.hub.BroadcastToRoom(client.RoomCode, broadcast, client.ID)
}

func (h *WSHandler) handleMediaChange(client *ws.Client, msg ws.Message) {
	var payload struct {
		SourceType string `json:"source_type"`
		SourceURL  string `json:"source_url"`
		Title      string `json:"title,omitempty"`
		Artist     string `json:"artist,omitempty"`
	}
	json.Unmarshal(msg.Payload, &payload)

	if rs, ok := h.roomHub.GetRoom(client.RoomCode); ok {
		rs.Mu.Lock()
		rs.Media.SourceType = payload.SourceType
		rs.Media.SourceURL = payload.SourceURL
		rs.Media.Title = payload.Title
		rs.Media.Artist = payload.Artist
		rs.Media.IsPlaying = false
		rs.Media.CurrentTime = 0
		rs.Media.StartedBy = client.UserID
		rs.Mu.Unlock()
	}

	broadcast, _ := ws.NewMessage("media.changed", payload)
	h.hub.BroadcastToRoom(client.RoomCode, broadcast, client.ID)
}

func (h *WSHandler) handleChatSend(client *ws.Client, msg ws.Message) {
	var payload struct {
		Content      string `json:"content"`
		MessageType  string `json:"message_type"`
	}
	json.Unmarshal(msg.Payload, &payload)

	if payload.Content == "" {
		return
	}

	var saved *chat.Message
	if h.chatSvc != nil && client.RoomCode != "" {
		rm, err := h.roomRepo.FindByCode(context.Background(), client.RoomCode)
		if err == nil {
			saved, _ = h.chatSvc.SaveMessage(context.Background(), rm.ID, client.UserID, client.Username, payload.Content)
		}
	}

	outPayload := map[string]interface{}{
		"user_id":  client.UserID,
		"username": client.Username,
		"content":  payload.Content,
	}
	if saved != nil {
		outPayload["id"] = saved.ID
		outPayload["created_at"] = saved.CreatedAt
	}

	broadcast, _ := ws.NewMessage("chat.message", outPayload)
	h.hub.BroadcastToRoom(client.RoomCode, broadcast)
}

func (h *WSHandler) handleTyping(client *ws.Client, msg ws.Message) {
	var payload struct {
		IsTyping bool `json:"is_typing"`
	}
	json.Unmarshal(msg.Payload, &payload)

	broadcast, _ := ws.NewMessage("chat.typing", map[string]interface{}{
		"user_id":   client.UserID,
		"is_typing": payload.IsTyping,
	})
	h.hub.BroadcastToRoom(client.RoomCode, broadcast, client.ID)
}

func (h *WSHandler) handleMute(client *ws.Client, msg ws.Message) {
	var payload struct {
		IsMuted bool `json:"is_muted"`
	}
	json.Unmarshal(msg.Payload, &payload)

	broadcast, _ := ws.NewMessage("call.mute", map[string]interface{}{
		"user_id":  client.UserID,
		"is_muted": payload.IsMuted,
	})
	h.hub.BroadcastToRoom(client.RoomCode, broadcast, client.ID)
}

func (h *WSHandler) handleSpeaking(client *ws.Client, msg ws.Message) {
	var payload struct {
		IsSpeaking bool `json:"is_speaking"`
	}
	json.Unmarshal(msg.Payload, &payload)

	broadcast, _ := ws.NewMessage("call.speaking", map[string]interface{}{
		"user_id":     client.UserID,
		"is_speaking": payload.IsSpeaking,
	})
	h.hub.BroadcastToRoom(client.RoomCode, broadcast, client.ID)
}

func (h *WSHandler) handlePlaylistAdd(client *ws.Client, msg ws.Message) {
	var payload struct {
		SourceType string `json:"source_type"`
		SourceURL  string `json:"source_url"`
		Title      string `json:"title"`
		Artist     string `json:"artist,omitempty"`
		Duration   int    `json:"duration"`
	}
	json.Unmarshal(msg.Payload, &payload)
	if payload.SourceURL == "" {
		return
	}

	h.mediaSvc.AddItem(client.RoomCode, payload.SourceType, payload.SourceURL, payload.Title, payload.Artist, payload.Duration, client.UserID, client.Username)

	queue := h.mediaSvc.GetQueue(client.RoomCode)
	broadcast, _ := ws.NewMessage("playlist.updated", map[string]interface{}{
		"items":       queue.Items,
		"now_playing": queue.NowPlaying,
	})
	h.hub.BroadcastToRoom(client.RoomCode, broadcast)

	if queue.NowPlaying == nil {
		next := h.mediaSvc.PlaySpecific(client.RoomCode, 0)
		if next != nil {
			nowPlaying, _ := ws.NewMessage("playlist.now_playing", map[string]interface{}{
				"item": next,
			})
			h.hub.BroadcastToRoom(client.RoomCode, nowPlaying)
		}
	}
}

func (h *WSHandler) handlePlaylistRemove(client *ws.Client, msg ws.Message) {
	var payload struct {
		ItemID string `json:"item_id"`
	}
	json.Unmarshal(msg.Payload, &payload)
	if payload.ItemID == "" {
		return
	}

	h.mediaSvc.RemoveItem(client.RoomCode, payload.ItemID)
	queue := h.mediaSvc.GetQueue(client.RoomCode)
	update, _ := ws.NewMessage("playlist.updated", queue)
	h.hub.BroadcastToRoom(client.RoomCode, update)
}

func (h *WSHandler) handlePlaylistSkip(client *ws.Client, msg ws.Message) {
	next := h.mediaSvc.Skip(client.RoomCode)
	queue := h.mediaSvc.GetQueue(client.RoomCode)

	broadcast, _ := ws.NewMessage("playlist.now_playing", map[string]interface{}{
		"item": next,
	})
	h.hub.BroadcastToRoom(client.RoomCode, broadcast)

	update, _ := ws.NewMessage("playlist.updated", queue)
	h.hub.BroadcastToRoom(client.RoomCode, update)
}

func (h *WSHandler) handlePlaylistPlay(client *ws.Client, msg ws.Message) {
	var payload struct {
		Position int `json:"position"`
	}
	json.Unmarshal(msg.Payload, &payload)

	item := h.mediaSvc.PlaySpecific(client.RoomCode, payload.Position)
	if item == nil {
		return
	}

	broadcast, _ := ws.NewMessage("playlist.now_playing", map[string]interface{}{
		"item": item,
	})
	h.hub.BroadcastToRoom(client.RoomCode, broadcast)
}

func sendError(client *ws.Client, code, message string) {
	errMsg, _ := ws.ErrorMsg(code, message)
	client.Send <- errMsg
}
