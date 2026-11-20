package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"slices"
	"sort"

	"optimolms/backend/internal/util"
)

// Per-user permission overrides, layered on top of the role's grants:
// role grants say what the role may do, user grants add to it per person.
// A user never loses a role permission here — this table only extends.

// Permission keys the AI assistant surfaces check, in one place so the seed,
// the chat handler and the provider handlers cannot drift apart.
const (
	PermAssistantUse       = "assistant.use"
	PermAssistantConfigure = "assistant.configure"
)

type userPermissionsOut struct {
	UserID      string   `json:"user_id"`
	Role        string   `json:"role"`
	RoleGrants  []string `json:"role_grants"`
	ExtraGrants []string `json:"extra_grants"`
	Effective   []string `json:"effective"`
}

func roleGrantKeys(ctx context.Context, db *sql.DB, userID string) (role string, grants []string, err error) {
	err = db.QueryRowContext(ctx, `
		SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`, userID).Scan(&role)
	if err != nil {
		return "", nil, err
	}
	var rows *sql.Rows
	if role == "ADMIN" {
		// ADMIN is a wildcard: every permission in the catalogue.
		rows, err = db.QueryContext(ctx, `SELECT key FROM permissions ORDER BY key`)
	} else {
		rows, err = db.QueryContext(ctx, `
			SELECT p.key FROM role_permissions rp
			JOIN permissions p ON p.id = rp.permission_id
			JOIN users u ON u.role_id = rp.role_id
			WHERE u.id = ? ORDER BY p.key`, userID)
	}
	if err != nil {
		return role, nil, err
	}
	defer rows.Close()
	grants = []string{}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err == nil {
			grants = append(grants, key)
		}
	}
	return role, grants, rows.Err()
}

func extraGrantKeys(ctx context.Context, db *sql.DB, userID string) ([]string, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT p.key FROM user_permissions up
		JOIN permissions p ON p.id = up.permission_id
		WHERE up.user_id = ? ORDER BY p.key`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := []string{}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err == nil {
			keys = append(keys, key)
		}
	}
	return keys, rows.Err()
}

// effectivePermissionKeys merges role grants with user extras; used by login
// so the frontend's hasPermission() already sees the override.
func effectivePermissionKeys(ctx context.Context, db *sql.DB, userID string) ([]string, error) {
	_, grants, err := roleGrantKeys(ctx, db, userID)
	if err != nil {
		return nil, err
	}
	extras, err := extraGrantKeys(ctx, db, userID)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{}, len(grants)+len(extras))
	merged := make([]string, 0, len(grants)+len(extras))
	for _, key := range append(grants, extras...) {
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		merged = append(merged, key)
	}
	sort.Strings(merged)
	return merged, nil
}

// userHasPermission reports whether key is part of the user's effective
// permissions. An unknown user surfaces as sql.ErrNoRows, so callers can tell
// "signed out" apart from "signed in without the permission".
func userHasPermission(ctx context.Context, db *sql.DB, userID, key string) (bool, error) {
	keys, err := effectivePermissionKeys(ctx, db, userID)
	if err != nil {
		return false, err
	}
	return slices.Contains(keys, key), nil
}

// accessibleModules lists the module keys the user can reach, mirroring how
// login resolves them: ADMIN holds every module, everybody else gets the
// modules granted to their role.
func accessibleModules(ctx context.Context, db *sql.DB, userID string) ([]string, error) {
	role, err := roleOf(ctx, db, userID)
	if err != nil {
		return nil, err
	}
	var rows *sql.Rows
	if role == "ADMIN" {
		rows, err = db.QueryContext(ctx, `SELECT key FROM modules ORDER BY key`)
	} else {
		rows, err = db.QueryContext(ctx, `
			SELECT m.key FROM role_modules rm
			JOIN modules m ON m.id = rm.module_id
			JOIN users u ON u.role_id = rm.role_id
			WHERE u.id = ? ORDER BY m.key`, userID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	modules := []string{}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err == nil {
			modules = append(modules, key)
		}
	}
	return modules, rows.Err()
}

// accessScope is what the assistant is allowed to talk about: the modules the
// user can reach and the permissions they hold.
type accessScope struct {
	Modules     []string
	Permissions []string
}

func loadAccessScope(ctx context.Context, db *sql.DB, userID string) (accessScope, error) {
	modules, err := accessibleModules(ctx, db, userID)
	if err != nil {
		return accessScope{}, err
	}
	permissions, err := effectivePermissionKeys(ctx, db, userID)
	if err != nil {
		return accessScope{}, err
	}
	return accessScope{Modules: modules, Permissions: permissions}, nil
}

func registerUserPermissions(mux *http.ServeMux, db *sql.DB) {
	// GET returns the role's grants and the per-user extras side by side so a
	// dialog can show "inherited" versus "granted to this person".
	mux.HandleFunc("GET /api/users/{userID}/permissions", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		userID := r.PathValue("userID")

		role, grants, err := roleGrantKeys(ctx, db, userID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		extras, err := extraGrantKeys(ctx, db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		effective, err := effectivePermissionKeys(ctx, db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, userPermissionsOut{
			UserID:      userID,
			Role:        role,
			RoleGrants:  grants,
			ExtraGrants: extras,
			Effective:   effective,
		})
	})

	// PUT replaces just the extras; role grants stay untouched.
	mux.HandleFunc("PUT /api/users/{userID}/permissions", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		userID := r.PathValue("userID")

		var body struct {
			PermissionKeys []string `json:"permission_keys"`
			GrantedBy      string   `json:"granted_by"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var exists int
		if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE id = ?`, userID).Scan(&exists); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if exists == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}

		// Resolve keys first, rejecting unknown ones before touching the table.
		ids := make([]string, 0, len(body.PermissionKeys))
		seen := map[string]struct{}{}
		for _, key := range body.PermissionKeys {
			var id string
			err := db.QueryRowContext(ctx, `SELECT id FROM permissions WHERE key = ?`, key).Scan(&id)
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown permission: " + key})
				return
			}
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			ids = append(ids, id)
		}

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM user_permissions WHERE user_id = ?`, userID); err != nil {
			_ = tx.Rollback()
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		now := util.Now()
		for _, permissionID := range ids {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO user_permissions (user_id, permission_id, granted_by, created_at)
				VALUES (?, ?, NULLIF(?, ''), ?)`, userID, permissionID, body.GrantedBy, now); err != nil {
				_ = tx.Rollback()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		if _, err := tx.ExecContext(ctx, `UPDATE users SET updated_at = ? WHERE id = ?`, now, userID); err != nil {
			_ = tx.Rollback()
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		role, grants, err := roleGrantKeys(ctx, db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		extras, err := extraGrantKeys(ctx, db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		effective, err := effectivePermissionKeys(ctx, db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, userPermissionsOut{
			UserID:      userID,
			Role:        role,
			RoleGrants:  grants,
			ExtraGrants: extras,
			Effective:   effective,
		})
	})
}
