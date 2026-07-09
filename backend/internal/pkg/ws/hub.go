package ws

import (
	"log"
	"sync"
)

type MessageHandler func(client *Client, msg Message)

type Hub struct {
	mu       sync.RWMutex
	clients  map[string]*Client
	rooms    map[string]map[string]*Client
	handler  MessageHandler
}

func NewHub(handler MessageHandler) *Hub {
	return &Hub{
		clients: make(map[string]*Client),
		rooms:   make(map[string]map[string]*Client),
		handler: handler,
	}
}

func (h *Hub) SetHandler(handler MessageHandler) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.handler = handler
}

func (h *Hub) GetHandler() MessageHandler {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.handler
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[client.ID] = client
	log.Printf("ws client registered: %s (user: %s)", client.ID, client.UserID)
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client.RoomCode != "" {
		if room, ok := h.rooms[client.RoomCode]; ok {
			delete(room, client.ID)
			if len(room) == 0 {
				delete(h.rooms, client.RoomCode)
			}
		}
	}
	delete(h.clients, client.ID)
	close(client.Send)
	log.Printf("ws client unregistered: %s (user: %s)", client.ID, client.UserID)
}

func (h *Hub) AddToRoom(client *Client, roomCode string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	client.RoomCode = roomCode
	if _, ok := h.rooms[roomCode]; !ok {
		h.rooms[roomCode] = make(map[string]*Client)
	}
	h.rooms[roomCode][client.ID] = client
}

func (h *Hub) RemoveFromRoom(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client.RoomCode != "" {
		if room, ok := h.rooms[client.RoomCode]; ok {
			delete(room, client.ID)
			if len(room) == 0 {
				delete(h.rooms, client.RoomCode)
			}
		}
		client.RoomCode = ""
	}
}

func (h *Hub) BroadcastToRoom(roomCode string, msg []byte, excludeClientID ...string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	exclude := make(map[string]bool)
	for _, id := range excludeClientID {
		exclude[id] = true
	}

	if room, ok := h.rooms[roomCode]; ok {
		for _, client := range room {
			if !exclude[client.ID] {
				select {
				case client.Send <- msg:
				default:
					log.Printf("dropping message to slow client: %s", client.ID)
				}
			}
		}
	}
}

func (h *Hub) SendToClient(clientID string, msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if client, ok := h.clients[clientID]; ok {
		select {
		case client.Send <- msg:
		default:
			log.Printf("dropping message to slow client: %s", clientID)
		}
	}
}

func (h *Hub) GetRoomClients(roomCode string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var result []*Client
	if room, ok := h.rooms[roomCode]; ok {
		for _, client := range room {
			result = append(result, client)
		}
	}
	return result
}
