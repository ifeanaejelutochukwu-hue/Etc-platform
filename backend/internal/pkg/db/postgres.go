package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

type Pool struct {
	DB *sql.DB
}

func NewPool(ctx context.Context, path string) (*Pool, error) {
	if path == "" {
		path = "etc.db"
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("unable to open database: %w", err)
	}
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}
	pool := &Pool{DB: db}
	if err := pool.migrate(ctx); err != nil {
		return nil, fmt.Errorf("migration: %w", err)
	}
	return pool, nil
}

func (p *Pool) Close() {
	if p.DB != nil {
		p.DB.Close()
	}
}

func (p *Pool) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return p.DB.ExecContext(ctx, query, args...)
}

func (p *Pool) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return p.DB.QueryContext(ctx, query, args...)
}

func (p *Pool) QueryRow(ctx context.Context, query string, args ...interface{}) *sql.Row {
	return p.DB.QueryRowContext(ctx, query, args...)
}

func (p *Pool) migrate(ctx context.Context) error {
	schema := `
	CREATE TABLE IF NOT EXISTS otp_codes (
		phone TEXT PRIMARY KEY,
		code TEXT NOT NULL,
		expires_at TEXT NOT NULL,
		created_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		phone TEXT UNIQUE NOT NULL,
		username TEXT NOT NULL,
		display_name TEXT,
		avatar_url TEXT,
		created_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS rooms (
		id TEXT PRIMARY KEY,
		code TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		type TEXT NOT NULL DEFAULT 'public',
		owner_id TEXT NOT NULL,
		is_active INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS room_participants (
		room_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'member',
		is_muted INTEGER NOT NULL DEFAULT 0,
		joined_at TEXT NOT NULL,
		PRIMARY KEY (room_id, user_id)
	);
	CREATE TABLE IF NOT EXISTS messages (
		id TEXT PRIMARY KEY,
		room_id TEXT NOT NULL,
		sender_id TEXT NOT NULL,
		reply_to TEXT,
		type TEXT NOT NULL DEFAULT 'text',
		content TEXT NOT NULL,
		created_at TEXT NOT NULL
	);`
	if _, err := p.DB.ExecContext(ctx, schema); err != nil {
		return fmt.Errorf("create tables: %w", err)
	}
	log.Println("database migrated successfully")
	return nil
}
