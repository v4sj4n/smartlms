package db

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"sort"
	"strings"

	"smartlms/backend/internal/util"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

func migrate(ctx context.Context, db *sql.DB) error {
	if _, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
		  version    TEXT PRIMARY KEY,
		  applied_at TEXT NOT NULL
		)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		version := strings.SplitN(name, "_", 2)[0]
		var applied string
		err := db.QueryRowContext(ctx, `SELECT version FROM schema_migrations WHERE version = ?`, version).Scan(&applied)
		if err == nil {
			continue // already applied
		}
		if err != sql.ErrNoRows {
			return fmt.Errorf("check migration %s: %w", name, err)
		}

		content, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin migration %s: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx, string(content)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`, version, util.Now()); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("record migration %s: %w", name, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %s: %w", name, err)
		}
	}
	return nil
}
