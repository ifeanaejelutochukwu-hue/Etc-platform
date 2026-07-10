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
	// The `_loc=auto` parameter tells the modernc SQLite driver to parse
	// TEXT columns that look like timestamps into time.Time automatically,
	// which prevents scan errors on created_at / joined_at columns.
	dsn := path + "?_loc=auto"
	db, err := sql.Open("sqlite", dsn)
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
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL DEFAULT '',
		display_name TEXT,
		avatar_url TEXT,
		bio TEXT,
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
	);
	CREATE TABLE IF NOT EXISTS friendships (
		id TEXT PRIMARY KEY,
		requester_id TEXT NOT NULL,
		addressee_id TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		created_at TEXT NOT NULL,
		UNIQUE(requester_id, addressee_id)
	);
	CREATE TABLE IF NOT EXISTS conversations (
		id TEXT PRIMARY KEY,
		type TEXT NOT NULL DEFAULT 'direct',
		name TEXT,
		created_by TEXT NOT NULL,
		created_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS conversation_members (
		conversation_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		joined_at TEXT NOT NULL,
		last_read_at TEXT,
		PRIMARY KEY (conversation_id, user_id)
	);
	CREATE TABLE IF NOT EXISTS direct_messages (
		id TEXT PRIMARY KEY,
		conversation_id TEXT NOT NULL,
		sender_id TEXT NOT NULL,
		content TEXT NOT NULL,
		msg_type TEXT NOT NULL DEFAULT 'text',
		created_at TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_direct_messages_conv ON direct_messages(conversation_id, created_at);
	CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id, status);
	CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id, status);`

	if _, err := p.DB.ExecContext(ctx, schema); err != nil {
		return fmt.Errorf("create tables: %w", err)
	}
	// Non-destructive column additions for existing databases.
	_, _ = p.DB.ExecContext(ctx, `ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`)
	_, _ = p.DB.ExecContext(ctx, `ALTER TABLE users ADD COLUMN bio TEXT`)
	log.Println("database migrated successfully")
	return nil
}
