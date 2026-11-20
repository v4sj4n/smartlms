package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"smartlms/backend/internal/auth"
	"smartlms/backend/internal/util"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	User        map[string]any `json:"user"`
	Modules     []string       `json:"modules"`
	Permissions []string       `json:"permissions"`
}

// registerAuth wires POST /api/auth/login with per-role lockout:
// after roles.max_login_attempts consecutive failures the account is locked
// for roles.lock_minutes. A NULL max_login_attempts means unlimited tries.
func registerAuth(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("POST /api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var (
			id, email, hash, name, roleName string
			failed                           int
			lockedUntil                      sql.NullString
			maxAttempts                      sql.NullInt64
			lockMinutes                      int
		)
		err := db.QueryRowContext(ctx, `
			SELECT u.id, u.email, u.password_hash, u.name, r.name,
			       u.failed_login_attempts, u.locked_until,
			       r.max_login_attempts, r.lock_minutes
			FROM users u JOIN roles r ON r.id = u.role_id
			WHERE u.email = ?`, req.Email).
			Scan(&id, &email, &hash, &name, &roleName, &failed, &lockedUntil, &maxAttempts, &lockMinutes)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		now := time.Now().UTC()

		// locked?
		if lockedUntil.Valid && lockedUntil.String != "" {
			if lockTime, err := time.Parse(time.RFC3339, lockedUntil.String); err == nil && now.Before(lockTime) {
				writeJSON(w, http.StatusLocked, map[string]string{
					"error":        "account locked due to too many failed attempts",
					"locked_until": lockTime.UTC().Format(time.RFC3339),
				})
				return
			}
		}

		ok, err := auth.VerifyPassword(req.Password, hash)
		if err != nil || !ok {
			failed++
			var newLockedUntil any
			attemptsLeft := -1
			if maxAttempts.Valid {
				if int64(failed) >= maxAttempts.Int64 {
					lockTime := now.Add(time.Duration(lockMinutes) * time.Minute)
					newLockedUntil = lockTime.UTC().Format(time.RFC3339)
					attemptsLeft = 0
				} else {
					attemptsLeft = int(maxAttempts.Int64) - failed
				}
			}
			if _, err := db.ExecContext(ctx, `UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?`,
				failed, newLockedUntil, util.Now(), id); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			resp := map[string]any{"error": "invalid credentials"}
			if attemptsLeft >= 0 {
				resp["attempts_left"] = attemptsLeft
			}
			if newLockedUntil != nil {
				resp["error"] = "account locked due to too many failed attempts"
				resp["locked_until"] = newLockedUntil
				writeJSON(w, http.StatusLocked, resp)
				return
			}
			writeJSON(w, http.StatusUnauthorized, resp)
			return
		}

		// success: reset counters, load modules (ADMIN = all modules)
		if _, err := db.ExecContext(ctx, `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?`,
			util.Now(), id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		modules := []string{}
		var rows *sql.Rows
		if roleName == "ADMIN" {
			rows, err = db.QueryContext(ctx, `SELECT key FROM modules ORDER BY key`)
		} else {
			rows, err = db.QueryContext(ctx, `
				SELECT m.key FROM role_modules rm
				JOIN modules m ON m.id = rm.module_id
				JOIN users u ON u.role_id = rm.role_id
				WHERE u.id = ? ORDER BY m.key`, id)
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for rows.Next() {
			var key string
			if err := rows.Scan(&key); err == nil {
				modules = append(modules, key)
			}
		}
		rows.Close()

		// granted permission keys (ADMIN = wildcard, all permissions)
		permissions := []string{}
		var permRows *sql.Rows
		if roleName == "ADMIN" {
			permRows, err = db.QueryContext(ctx, `SELECT key FROM permissions ORDER BY key`)
		} else {
			permRows, err = db.QueryContext(ctx, `
				SELECT p.key FROM role_permissions rp
				JOIN permissions p ON p.id = rp.permission_id
				JOIN users u ON u.role_id = rp.role_id
				WHERE u.id = ? ORDER BY p.key`, id)
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for permRows.Next() {
			var key string
			if err := permRows.Scan(&key); err == nil {
				permissions = append(permissions, key)
			}
		}
		permRows.Close()

		writeJSON(w, http.StatusOK, loginResponse{
			User: map[string]any{
				"id": id, "email": email, "name": name, "role": roleName,
			},
			Modules:     modules,
			Permissions: permissions,
		})
	})
}
