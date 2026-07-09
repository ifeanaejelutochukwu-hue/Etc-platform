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
	"github.com/etc/backend/internal/media"
	"github.com/etc/backend/internal/pkg/config"
	"github.com/etc/backend/internal/pkg/ws"
	"github.com/etc/backend/internal/pkg/db"
	"github.com/etc/backend/internal/room"
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

	// Auth
	authRepo := auth.NewRepository(pool)
	authSvc := auth.NewService(authRepo, cfg.JWTSecret)
	authH := auth.NewHandler(authSvc)

	s.router.Post("/api/auth/request-otp", authH.RequestOTP)
	s.router.Post("/api/auth/verify-otp", authH.VerifyOTP)

	// Call service
	callSvc := call.NewService(cfg.LiveKitHost, cfg.LiveKitAPIKey, cfg.LiveKitAPISecret)

	// Rooms
	roomRepo := room.NewRepository(pool)
	roomStateHub := room.NewRoomHub()
	roomSvc := room.NewService(roomRepo, roomStateHub, callSvc)
	roomH := room.NewHandler(roomSvc)

	s.router.Group(func(r chi.Router) {
		r.Use(AuthMiddleware(cfg.JWTSecret))
		r.Post("/api/rooms", roomH.Create)
		r.Get("/api/rooms/{code}", roomH.Get)
		r.Post("/api/rooms/{code}/join", roomH.Join)
		r.Post("/api/rooms/{code}/leave", roomH.Leave)
	})

	// Chat
	chatRepo := chat.NewRepository(pool)
	chatSvc := chat.NewService(chatRepo)

	// Media/Playlist service
	mediaSvc := media.NewService()

	// WebSocket hub + room WS handler
	wsHub := ws.NewHub(nil)
	roomWS := room.NewWSHandler(roomSvc, wsHub, roomStateHub, chatSvc, roomRepo, mediaSvc)
	wsHub.SetHandler(roomWS.HandleMessage)

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
			CheckOrigin:      func(r *http.Request) bool { return true },
			ReadBufferSize:   4096,
			WriteBufferSize:  4096,
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

	s.hub = wsHub

	return s
}

func (s *Server) Start() error {
	addr := fmt.Sprintf(":%d", s.cfg.Port)
	log.Printf("ETC server starting on %s", addr)
	return http.ListenAndServe(addr, s.router)
}
