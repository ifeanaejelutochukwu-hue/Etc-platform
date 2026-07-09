package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotConnected = errors.New("database not connected")

type Pool struct {
	inner *pgxpool.Pool
}

func NewPool(ctx context.Context, databaseURL string) (*Pool, error) {
	if databaseURL == "" {
		return &Pool{}, nil
	}
	inner, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}
	if err := inner.Ping(ctx); err != nil {
		inner.Close()
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}
	return &Pool{inner: inner}, nil
}

func (p *Pool) Ping(ctx context.Context) error {
	if p.inner == nil {
		return ErrNotConnected
	}
	return p.inner.Ping(ctx)
}

func (p *Pool) Close() {
	if p.inner != nil {
		p.inner.Close()
	}
}

func (p *Pool) IsConnected() bool {
	return p.inner != nil
}

func (p *Pool) Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
	if p.inner == nil {
		return pgconn.CommandTag{}, ErrNotConnected
	}
	return p.inner.Exec(ctx, sql, args...)
}

func (p *Pool) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if p.inner == nil {
		return nil, ErrNotConnected
	}
	return p.inner.Query(ctx, sql, args...)
}

func (p *Pool) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	if p.inner == nil {
		return noopRow{}
	}
	return p.inner.QueryRow(ctx, sql, args...)
}

type noopRow struct{}

func (r noopRow) Scan(dest ...interface{}) error {
	return ErrNotConnected
}
