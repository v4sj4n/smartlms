package handler

import (
	"database/sql"
	"net/http"
	"sort"
)

type moduleOut struct {
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"`
}

type roleOut struct {
	ID      string      `json:"id"`
	Name    string      `json:"name"`
	Modules []moduleOut `json:"modules"`
}

type userOut struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

type metaOut struct {
	Roles []roleOut `json:"roles"`
	Users []userOut `json:"users"`
}

// GET /api/meta returns roles with their modules+permissions, and the seeded users.
func registerMeta(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/meta", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		roleRows, err := db.QueryContext(ctx, `SELECT id, name FROM roles ORDER BY name`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		roles := []roleOut{}
		roleIndex := map[string]int{}
		for roleRows.Next() {
			var ro roleOut
			if err := roleRows.Scan(&ro.ID, &ro.Name); err != nil {
				roleRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			roleIndex[ro.ID] = len(roles)
			ro.Modules = []moduleOut{}
			roles = append(roles, ro)
		}
		roleRows.Close()

		modRows, err := db.QueryContext(ctx, `
			SELECT rm.role_id, m.key, m.name
			FROM role_modules rm JOIN modules m ON m.id = rm.module_id
			ORDER BY m.key`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		moduleIndex := map[string]int{} // roleID+key -> index in role.Modules
		for modRows.Next() {
			var roleID, key, name string
			if err := modRows.Scan(&roleID, &key, &name); err != nil {
				modRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			ri, ok := roleIndex[roleID]
			if !ok {
				continue
			}
			moduleIndex[roleID+"|"+key] = len(roles[ri].Modules)
			roles[ri].Modules = append(roles[ri].Modules, moduleOut{Key: key, Name: name, Permissions: []string{}})
		}
		modRows.Close()

		permRows, err := db.QueryContext(ctx, `
			SELECT p.module_id, m.key, p.action
			FROM permissions p JOIN modules m ON m.id = p.module_id
			ORDER BY p.action`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for permRows.Next() {
			var moduleID, key, action string
			if err := permRows.Scan(&moduleID, &key, &action); err != nil {
				permRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			for ri := range roles {
				if idx, ok := moduleIndex[roles[ri].ID+"|"+key]; ok {
					roles[ri].Modules[idx].Permissions = append(roles[ri].Modules[idx].Permissions, action)
				}
			}
		}
		permRows.Close()

		for ri := range roles {
			sort.Slice(roles[ri].Modules, func(i, j int) bool {
				return roles[ri].Modules[i].Key < roles[ri].Modules[j].Key
			})
		}

		userRows, err := db.QueryContext(ctx, `
			SELECT u.email, u.name, r.name FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.email`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		users := []userOut{}
		for userRows.Next() {
			var u userOut
			if err := userRows.Scan(&u.Email, &u.Name, &u.Role); err != nil {
				userRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			users = append(users, u)
		}
		userRows.Close()

		writeJSON(w, http.StatusOK, metaOut{Roles: roles, Users: users})
	})
}
