package handler

import (
	"database/sql"
	"net/http"
	"sort"
)

type permissionOut struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

type moduleOut struct {
	Key         string          `json:"key"`
	Name        string          `json:"name"`
	Permissions []permissionOut `json:"permissions"`
}

type roleOut struct {
	ID      string      `json:"id"`
	Name    string      `json:"name"`
	Modules []moduleOut `json:"modules"`
	Granted []string    `json:"granted"` // granted permission keys
}

type userOut struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

type metaOut struct {
	Modules []moduleOut `json:"modules"` // full permission catalog
	Roles   []roleOut   `json:"roles"`
	Users   []userOut   `json:"users"`
}

// GET /api/meta returns the module/permission catalog, roles with their module
// access and granted permission keys, and the seeded users.
func registerMeta(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/meta", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// catalog: modules -> permissions
		modRows, err := db.QueryContext(ctx, `SELECT id, key, name FROM modules ORDER BY key`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		modules := []moduleOut{}
		moduleIndex := map[string]int{}
		for modRows.Next() {
			var id string
			var m moduleOut
			if err := modRows.Scan(&id, &m.Key, &m.Name); err != nil {
				modRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			m.Permissions = []permissionOut{}
			moduleIndex[id] = len(modules)
			modules = append(modules, m)
		}
		modRows.Close()

		permRows, err := db.QueryContext(ctx, `
			SELECT module_id, key, label, COALESCE(description, '')
			FROM permissions ORDER BY key`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for permRows.Next() {
			var moduleID string
			var p permissionOut
			if err := permRows.Scan(&moduleID, &p.Key, &p.Label, &p.Description); err != nil {
				permRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if idx, ok := moduleIndex[moduleID]; ok {
				modules[idx].Permissions = append(modules[idx].Permissions, p)
			}
		}
		permRows.Close()

		// roles
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
			ro.Modules = []moduleOut{}
			ro.Granted = []string{}
			roleIndex[ro.ID] = len(roles)
			roles = append(roles, ro)
		}
		roleRows.Close()

		accessRows, err := db.QueryContext(ctx, `
			SELECT rm.role_id, m.key
			FROM role_modules rm JOIN modules m ON m.id = rm.module_id
			ORDER BY m.key`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for accessRows.Next() {
			var roleID, key string
			if err := accessRows.Scan(&roleID, &key); err != nil {
				accessRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			ri, ok := roleIndex[roleID]
			if !ok {
				continue
			}
			for _, m := range modules {
				if m.Key == key {
					roles[ri].Modules = append(roles[ri].Modules, m)
					break
				}
			}
		}
		accessRows.Close()

		grantRows, err := db.QueryContext(ctx, `
			SELECT rp.role_id, p.key
			FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
			ORDER BY p.key`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for grantRows.Next() {
			var roleID, key string
			if err := grantRows.Scan(&roleID, &key); err != nil {
				grantRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if ri, ok := roleIndex[roleID]; ok {
				roles[ri].Granted = append(roles[ri].Granted, key)
			}
		}
		grantRows.Close()

		for ri := range roles {
			sort.Strings(roles[ri].Granted)
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

		writeJSON(w, http.StatusOK, metaOut{Modules: modules, Roles: roles, Users: users})
	})
}
