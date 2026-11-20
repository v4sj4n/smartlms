package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func Register(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "up"
		if err := db.PingContext(r.Context()); err != nil {
			dbStatus = "down"
		}
		writeJSON(w, http.StatusOK, map[string]string{
			"status":  "ok",
			"service": "smartlms-backend",
			"db":      dbStatus,
		})
	})
	registerAuth(mux, db)
	registerMeta(mux, db)
	registerCampuses(mux, db)
	registerRoles(mux, db)
	registerCourses(mux, db)
	registerNotifications(mux, db)
}
