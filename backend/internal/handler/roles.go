package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"smartlms/backend/internal/util"
)

// PUT /api/roles/{roleID}/permissions
// Body: {"permission_keys": ["campuses.view", "campuses.manage", ...]}
// Replaces the role's granted permissions. (Server-side auth is added with
// sessions; for now the UI hides this to non-admin roles.)
func registerRoles(mux *http.ServeMux, db *sql.DB) {
	// POST /api/roles
	// Body: {"name": "LIBRARIAN", "copy_from": "<roleID>"?}
	// Creates a role. With copy_from, the new role starts with that role's
	// modules and permission grants; without it, it starts with nothing.
	mux.HandleFunc("POST /api/roles", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var body struct {
			Name     string `json:"name"`
			CopyFrom string `json:"copy_from"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		name := strings.ToUpper(strings.Join(strings.Fields(body.Name), "_"))
		if name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		var taken int
		if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM roles WHERE name = ?`, name).Scan(&taken); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if taken > 0 {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "a role named " + name + " already exists"})
			return
		}
		if body.CopyFrom != "" {
			var exists int
			if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM roles WHERE id = ?`, body.CopyFrom).Scan(&exists); err != nil || exists == 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "role to import from not found"})
				return
			}
		}

		id := util.NewID()
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		stmts := []string{`INSERT INTO roles (id, name) VALUES (?, ?)`}
		args := [][]any{{id, name}}
		if body.CopyFrom != "" {
			stmts = append(stmts,
				`INSERT INTO role_modules (role_id, module_id) SELECT ?, module_id FROM role_modules WHERE role_id = ?`,
				`INSERT INTO role_permissions (role_id, permission_id) SELECT ?, permission_id FROM role_permissions WHERE role_id = ?`)
			args = append(args, []any{id, body.CopyFrom}, []any{id, body.CopyFrom})
		}
		for i, stmt := range stmts {
			if _, err := tx.ExecContext(ctx, stmt, args[i]...); err != nil {
				_ = tx.Rollback()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"id": id, "name": name})
	})

	mux.HandleFunc("PUT /api/roles/{roleID}/permissions", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		roleID := r.PathValue("roleID")

		var body struct {
			PermissionKeys []string `json:"permission_keys"`
			// Optional: when present, replaces the role's module access too.
			ModuleKeys *[]string `json:"module_keys"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var roleName string
		if err := db.QueryRowContext(ctx, `SELECT name FROM roles WHERE id = ?`, roleID).Scan(&roleName); err != nil {
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "role not found"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// resolve permission ids, rejecting unknown keys
		idByKey := map[string]string{}
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
			idByKey[key] = id
		}

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM role_permissions WHERE role_id = ?`, roleID); err != nil {
			_ = tx.Rollback()
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		keys := make([]string, 0, len(idByKey))
		for key, permissionID := range idByKey {
			if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
				roleID, permissionID); err != nil {
				_ = tx.Rollback()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			keys = append(keys, key)
		}
		if body.ModuleKeys != nil {
			if _, err := tx.ExecContext(ctx, `DELETE FROM role_modules WHERE role_id = ?`, roleID); err != nil {
				_ = tx.Rollback()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			for _, key := range *body.ModuleKeys {
				res, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO role_modules (role_id, module_id)
					SELECT ?, id FROM modules WHERE key = ?`, roleID, key)
				if err != nil {
					_ = tx.Rollback()
					writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
					return
				}
				if n, _ := res.RowsAffected(); n == 0 {
					var exists int
					_ = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM modules WHERE key = ?`, key).Scan(&exists)
					if exists == 0 {
						_ = tx.Rollback()
						writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown module: " + key})
						return
					}
				}
			}
		}
		if _, err := tx.ExecContext(ctx, `UPDATE users SET updated_at = ? WHERE role_id = ?`, util.Now(), roleID); err != nil {
			_ = tx.Rollback()
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		sortStrings(keys)
		writeJSON(w, http.StatusOK, map[string]any{
			"role":    roleName,
			"granted": keys,
		})
	})
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}
