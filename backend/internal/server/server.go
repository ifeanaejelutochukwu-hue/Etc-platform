package server

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"

	"github.com/etc/backend/internal/auth"
	"github.com/etc/backend/internal/call"
	"github.com/etc/backend/internal/chat"
	"github.com/etc/backend/internal/dm"
	"github.com/etc/backend/internal/media"
	"github.com/etc/backend/internal/pkg/config"
	"github.com/etc/backend/internal/pkg/db"
	"github.com/etc/backend/internal/pkg/ws"
	"github.com/etc/backend/internal/room"
	"github.com/etc/backend/internal/social"
)

type Server struct {
	cfg    *config.Config
	router *chi.Mux
	hub    *ws.Hub
}

func New(cfg *config.Config, pool *db.Pool) *Server {
	s := &Server{
		cfg:    cfg,
		router: chi.NewRouter(),
	}

	s.router.Use(middleware.Logger)
	s.router.Use(middleware.Recoverer)
	s.router.Use(CORSMiddleware)

	s.router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// ── Auth ────────────────────────────────────────────────────────────────
	authRepo := auth.NewRepository(pool)
	authSvc := auth.NewService(authRepo, cfg.JWTSecret)
	authH := auth.NewHandler(authSvc)
	s.router.Post("/api/auth/register", authH.Register)
	s.router.Post("/api/auth/login", authH.Login)

	// ── WebSocket hub (created early so DM handler can use it) ─────────────
	wsHub := ws.NewHub(nil)
	s.hub = wsHub

	// ── Social ──────────────────────────────────────────────────────────────
	socialRepo := social.NewRepository(pool)
	socialH := social.NewHandler(socialRepo)

	// ── DM ──────────────────────────────────────────────────────────────────
	dmRepo := dm.NewRepository(pool)
	dmH := dm.NewHandler(dmRepo, wsHub)

	// ── Call ────────────────────────────────────────────────────────────────
	callSvc := call.NewService(cfg.LiveKitHost, cfg.LiveKitAPIKey, cfg.LiveKitAPISecret)

	// ── Rooms ───────────────────────────────────────────────────────────────
	roomRepo := room.NewRepository(pool)
	roomStateHub := room.NewRoomHub()
	roomSvc := room.NewService(roomRepo, roomStateHub, callSvc)
	roomH := room.NewHandler(roomSvc)

	// ── Chat (room chat) ────────────────────────────────────────────────────
	chatRepo := chat.NewRepository(pool)
	chatSvc := chat.NewService(chatRepo)

	// ── Media/Playlist ──────────────────────────────────────────────────────
	mediaSvc := media.NewService()

	// ── Room WS handler ─────────────────────────────────────────────────────
	roomWS := room.NewWSHandler(roomSvc, wsHub, roomStateHub, chatSvc, roomRepo, mediaSvc)
	wsHub.SetHandler(roomWS.HandleMessage)

	// ── Protected routes ────────────────────────────────────────────────────
	s.router.Group(func(r chi.Router) {
		r.Use(AuthMiddleware(cfg.JWTSecret))

		// Rooms
		r.Post("/api/rooms", roomH.Create)
		r.Get("/api/rooms/{code}", roomH.Get)
		r.Post("/api/rooms/{code}/join", roomH.Join)
		r.Post("/api/rooms/{code}/leave", roomH.Leave)

		// Social — user search & profiles
		r.Get("/api/users/search", socialH.SearchUsers)
		r.Get("/api/users/{id}", socialH.GetProfile)
		r.Get("/api/me/profile", socialH.GetMyProfile)
		r.Patch("/api/me/bio", socialH.UpdateBio)

		// Social — friends
		r.Post("/api/friends/request/{id}", socialH.SendRequest)
		r.Post("/api/friends/accept/{id}", socialH.AcceptRequest)
		r.Post("/api/friends/decline/{id}", socialH.DeclineRequest)
		r.Get("/api/friends", socialH.ListFriends)
		r.Get("/api/friends/pending", socialH.ListPending)

		// Discover feed
		r.Get("/api/discover", socialH.Discover)

		// DM conversations
		r.Post("/api/dm/direct/{userID}", dmH.GetOrCreateDirect)
		r.Post("/api/dm/group", dmH.CreateGroup)
		r.Get("/api/dm/conversations", dmH.ListConversations)
		r.Get("/api/dm/conversations/{id}", dmH.GetConversation)
		r.Get("/api/dm/conversations/{id}/messages", dmH.GetMessages)
		r.Post("/api/dm/conversations/{id}/messages", dmH.SendMessage)
	})

	// ── WebSocket endpoint ───────────────────────────────────────────────────
	s.router.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, `{"error":"missing token"}`, http.StatusUnauthorized)
			return
		}
		claims, err := auth.ValidateToken(token, cfg.JWTSecret)
		if err != nil {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}
		upgrader := websocket.Upgrader{
			CheckOrigin:     func(r *http.Request) bool { return true },
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("ws upgrade error: %v", err)
			return
		}
		client := ws.NewClient(
			fmt.Sprintf("cli_%s_%d", claims.UserID, time.Now().UnixNano()),
			claims.UserID,
			claims.Name,
			wsHub,
			conn,
		)
		wsHub.Register(client)
		go client.WritePump()
		go client.ReadPump(wsHub.GetHandler())
	})

	return s
}

func (s *Server) Start() error {
	addr := fmt.Sprintf(":%d", s.cfg.Port)
	log.Printf("ETC server starting on %s", addr)
	return http.ListenAndServe(addr, s.router)
}
