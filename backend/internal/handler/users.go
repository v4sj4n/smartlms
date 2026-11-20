package handler

import (
	"database/sql"
	"net/http"
	"strings"
)

type userRowOut struct {
	ID                  string `json:"id"`
	Email               string `json:"email"`
	Name                string `json:"name"`
	Role                string `json:"role"`
	FailedLoginAttempts int    `json:"failed_login_attempts"`
	LockedUntil         string `json:"locked_until,omitempty"`
	TwoFactorEnabled    bool   `json:"two_factor_enabled"`
}

type pageOut struct {
	Items    any `json:"items"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

// GET /api/users?page=&page_size=&role=&search= — paginated user table.
func registerUsers(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/users", func(w http.ResponseWriter, r *http.Request) {
		page, size := pagination(r)
		role := strings.TrimSpace(r.URL.Query().Get("role"))
		search := strings.TrimSpace(r.URL.Query().Get("search"))

		where := []string{"1 = 1"}
		args := []any{}
		if role != "" {
			where = append(where, "r.name = ?")
			args = append(args, role)
		}
		if search != "" {
			where = append(where, "(u.email LIKE ? OR u.name LIKE ?)")
			like := "%" + search + "%"
			args = append(args, like, like)
		}
		clause := strings.Join(where, " AND ")

		var total int
		if err := db.QueryRowContext(r.Context(), `
			SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE `+clause, args...).Scan(&total); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		queryArgs := append(append([]any{}, args...), size, offset(page, size))
		rows, err := db.QueryContext(r.Context(), `
			SELECT u.id, u.email, u.name, r.name, u.failed_login_attempts, COALESCE(u.locked_until, ''),
			       CASE WHEN u.totp_enabled_at IS NOT NULL AND u.totp_secret IS NOT NULL THEN 1 ELSE 0 END
			FROM users u JOIN roles r ON r.id = u.role_id
			WHERE `+clause+`
			ORDER BY u.email
			LIMIT ? OFFSET ?`, queryArgs...)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		items := []userRowOut{}
		for rows.Next() {
			var u userRowOut
			var twoFactor int
			if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.FailedLoginAttempts, &u.LockedUntil, &twoFactor); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			u.TwoFactorEnabled = twoFactor == 1
			items = append(items, u)
		}

		writeJSON(w, http.StatusOK, pageOut{Items: items, Total: total, Page: page, PageSize: size})
	})
}
