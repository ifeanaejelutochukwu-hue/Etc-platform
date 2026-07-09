package main

import (
	"context"
	"log"

	"github.com/etc/backend/internal/pkg/config"
	"github.com/etc/backend/internal/pkg/db"
	"github.com/etc/backend/internal/server"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Printf("warning: database not available: %v", err)
		pool = &db.Pool{}
	}

	srv := server.New(cfg, pool)
	if err := srv.Start(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
