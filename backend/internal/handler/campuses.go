package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"smartlms/backend/internal/util"
)

type classOut struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Capacity int      `json:"capacity"`
	Tags     []string `json:"tags"`
}

type storyOut struct {
	ID      string     `json:"id"`
	Floor   int        `json:"floor"`
	Name    string     `json:"name"`
	Classes []classOut `json:"classes"`
}

type campusOut struct {
	ID      string     `json:"id"`
	Name    string     `json:"name"`
	Address string     `json:"address,omitempty"`
	Stories []storyOut `json:"stories"`
}

// GET /api/campuses returns campuses with nested stories and classes, and the
// write endpoints below let campuses/stories/classes be edited freely.
func registerCampuses(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/campuses", listCampuses(db))
	mux.HandleFunc("POST /api/campuses", createCampus(db))
	mux.HandleFunc("PATCH /api/campuses/{id}", updateCampus(db))
	mux.HandleFunc("DELETE /api/campuses/{id}", deleteCampus(db))

	mux.HandleFunc("POST /api/campuses/{id}/stories", createStory(db))
	mux.HandleFunc("PATCH /api/stories/{id}", updateStory(db))
	mux.HandleFunc("DELETE /api/stories/{id}", deleteStory(db))

	mux.HandleFunc("POST /api/stories/{id}/classes", createClass(db))
	mux.HandleFunc("PATCH /api/classes/{id}", updateClass(db))
	mux.HandleFunc("DELETE /api/classes/{id}", deleteClass(db))
}

func listCampuses(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		campusRows, err := db.QueryContext(ctx, `SELECT id, name, COALESCE(address, '') FROM campuses ORDER BY name`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		campuses := []campusOut{}
		campusIndex := map[string]int{}
		for campusRows.Next() {
			var c campusOut
			if err := campusRows.Scan(&c.ID, &c.Name, &c.Address); err != nil {
				campusRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			campusIndex[c.ID] = len(campuses)
			c.Stories = []storyOut{}
			campuses = append(campuses, c)
		}
		campusRows.Close()

		storyRows, err := db.QueryContext(ctx, `SELECT id, campus_id, floor_number, COALESCE(name, '') FROM stories ORDER BY campus_id, floor_number`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		type storyPos struct{ campus, story int }
		storyIndex := map[string]storyPos{}
		for storyRows.Next() {
			var s storyOut
			var campusID string
			if err := storyRows.Scan(&s.ID, &campusID, &s.Floor, &s.Name); err != nil {
				storyRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			ci, ok := campusIndex[campusID]
			if !ok {
				continue
			}
			storyIndex[s.ID] = storyPos{ci, len(campuses[ci].Stories)}
			s.Classes = []classOut{}
			campuses[ci].Stories = append(campuses[ci].Stories, s)
		}
		storyRows.Close()

		classRows, err := db.QueryContext(ctx, `SELECT id, story_id, name, capacity, tags FROM classes ORDER BY story_id, name`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for classRows.Next() {
			var c classOut
			var storyID, tagsJSON string
			if err := classRows.Scan(&c.ID, &storyID, &c.Name, &c.Capacity, &tagsJSON); err != nil {
				classRows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			_ = json.Unmarshal([]byte(tagsJSON), &c.Tags)
			if c.Tags == nil {
				c.Tags = []string{}
			}
			pos, ok := storyIndex[storyID]
			if !ok {
				continue
			}
			campuses[pos.campus].Stories[pos.story].Classes = append(campuses[pos.campus].Stories[pos.story].Classes, c)
		}
		classRows.Close()

		writeJSON(w, http.StatusOK, campuses)
	}
}

/* ---------- campuses ---------- */

func createCampus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name    string `json:"name"`
			Address string `json:"address"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if strings.TrimSpace(body.Name) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO campuses (id, name, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
			id, strings.TrimSpace(body.Name), body.Address, now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, campusOut{ID: id, Name: strings.TrimSpace(body.Name), Address: body.Address, Stories: []storyOut{}})
	}
}

func updateCampus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Name    *string `json:"name"`
			Address *string `json:"address"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if body.Name == nil && body.Address == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		sets := []string{"updated_at = ?"}
		args := []any{util.Now()}
		if body.Name != nil {
			if strings.TrimSpace(*body.Name) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name cannot be empty"})
				return
			}
			sets = append(sets, "name = ?")
			args = append(args, strings.TrimSpace(*body.Name))
		}
		if body.Address != nil {
			sets = append(sets, "address = ?")
			args = append(args, *body.Address)
		}
		args = append(args, id)
		res, err := db.ExecContext(r.Context(), `UPDATE campuses SET `+strings.Join(sets, ", ")+` WHERE id = ?`, args...)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "campus not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteCampus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `DELETE FROM campuses WHERE id = ?`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "campus not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

/* ---------- stories ---------- */

func createStory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		campusID := r.PathValue("id")
		var body struct {
			Floor int    `json:"floor"`
			Name  string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		var exists int
		if err := db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM campuses WHERE id = ?`, campusID).Scan(&exists); err != nil || exists == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "campus not found"})
			return
		}
		id := util.NewID()
		_, err := db.ExecContext(r.Context(), `INSERT INTO stories (id, campus_id, floor_number, name) VALUES (?, ?, ?, ?)`,
			id, campusID, body.Floor, strings.TrimSpace(body.Name))
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "this campus already has a story on that floor"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, storyOut{ID: id, Floor: body.Floor, Name: strings.TrimSpace(body.Name), Classes: []classOut{}})
	}
}

func updateStory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Floor *int    `json:"floor"`
			Name  *string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if body.Floor == nil && body.Name == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		sets := []string{}
		args := []any{}
		if body.Floor != nil {
			sets = append(sets, "floor_number = ?")
			args = append(args, *body.Floor)
		}
		if body.Name != nil {
			sets = append(sets, "name = ?")
			args = append(args, strings.TrimSpace(*body.Name))
		}
		args = append(args, id)
		res, err := db.ExecContext(r.Context(), `UPDATE stories SET `+strings.Join(sets, ", ")+` WHERE id = ?`, args...)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "this campus already has a story on that floor"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "story not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteStory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `DELETE FROM stories WHERE id = ?`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "story not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

/* ---------- classes (rooms) ---------- */

func createClass(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		storyID := r.PathValue("id")
		var body struct {
			Name     string   `json:"name"`
			Capacity int      `json:"capacity"`
			Tags     []string `json:"tags"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if strings.TrimSpace(body.Name) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		if body.Capacity <= 0 {
			body.Capacity = 30
		}
		var exists int
		if err := db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM stories WHERE id = ?`, storyID).Scan(&exists); err != nil || exists == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "story not found"})
			return
		}
		if body.Tags == nil {
			body.Tags = []string{}
		}
		id, now := util.NewID(), util.Now()
		tagsJSON, _ := json.Marshal(body.Tags)
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO classes (id, story_id, name, capacity, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, storyID, strings.TrimSpace(body.Name), body.Capacity, string(tagsJSON), now, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, classOut{ID: id, Name: strings.TrimSpace(body.Name), Capacity: body.Capacity, Tags: body.Tags})
	}
}

func updateClass(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Name     *string   `json:"name"`
			Capacity *int      `json:"capacity"`
			Tags     *[]string `json:"tags"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if body.Name == nil && body.Capacity == nil && body.Tags == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		sets := []string{"updated_at = ?"}
		args := []any{util.Now()}
		if body.Name != nil {
			if strings.TrimSpace(*body.Name) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name cannot be empty"})
				return
			}
			sets = append(sets, "name = ?")
			args = append(args, strings.TrimSpace(*body.Name))
		}
		if body.Capacity != nil {
			if *body.Capacity <= 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "capacity must be greater than 0"})
				return
			}
			sets = append(sets, "capacity = ?")
			args = append(args, *body.Capacity)
		}
		if body.Tags != nil {
			tagsJSON, _ := json.Marshal(*body.Tags)
			sets = append(sets, "tags = ?")
			args = append(args, string(tagsJSON))
		}
		args = append(args, id)
		res, err := db.ExecContext(r.Context(), `UPDATE classes SET `+strings.Join(sets, ", ")+` WHERE id = ?`, args...)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "class not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteClass(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `DELETE FROM classes WHERE id = ?`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "class not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
