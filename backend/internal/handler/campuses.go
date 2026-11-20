package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type classOut struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Capacity int      `json:"capacity"`
	Tags     []string `json:"tags"`
}

type storyOut struct {
	ID        string     `json:"id"`
	Floor     int        `json:"floor"`
	Name      string     `json:"name"`
	Classes   []classOut `json:"classes"`
}

type campusOut struct {
	ID       string     `json:"id"`
	Name     string     `json:"name"`
	Address  string     `json:"address,omitempty"`
	Stories  []storyOut `json:"stories"`
}

// GET /api/campuses returns campuses with nested stories and classes (rooms).
func registerCampuses(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/campuses", func(w http.ResponseWriter, r *http.Request) {
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
		storyIndex := map[string]int{} // storyID -> (campus idx, story idx)
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
			storyIndex[s.ID] = ci*1000 + len(campuses[ci].Stories)
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
			packed, ok := storyIndex[storyID]
			if !ok {
				continue
			}
			ci, si := packed/1000, packed%1000
			campuses[ci].Stories[si].Classes = append(campuses[ci].Stories[si].Classes, c)
		}
		classRows.Close()

		writeJSON(w, http.StatusOK, campuses)
	})
}
