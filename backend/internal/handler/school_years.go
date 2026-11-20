package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"smartlms/backend/internal/util"
)

type schoolYearOut struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	StartsOn string `json:"starts_on,omitempty"`
	EndsOn   string `json:"ends_on,omitempty"`
	IsActive bool   `json:"is_active"`
	// Subjects is how many subjects are scheduled into this year.
	Subjects int `json:"subjects"`
}

type schoolYearListOut struct {
	Items []schoolYearOut `json:"items"`
	// Active is the name of the current year, empty when none is set.
	Active string `json:"active,omitempty"`
}

// A school year is two calendar years: 2026/2027. Both separators are accepted
// and the slash form is what gets stored.
var (
	yearNamePattern = regexp.MustCompile(`^(\d{4})\s*[-/]\s*(\d{4})$`)
	isoDatePattern  = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

	// newest year first, the way a calendar reads
	schoolYearOrder = `ORDER BY y.name DESC`
)

// normalizeYearName validates an academic year and returns its stored form.
func normalizeYearName(raw string) (string, bool) {
	match := yearNamePattern.FindStringSubmatch(strings.TrimSpace(raw))
	if match == nil {
		return "", false
	}
	return match[1] + "/" + match[2], true
}

// normalizeYearDate validates an optional ISO date.
func normalizeYearDate(raw string) (string, bool) {
	date := strings.TrimSpace(raw)
	if date == "" {
		return "", true
	}
	return date, isoDatePattern.MatchString(date)
}

// activeSchoolYear returns the name of the current academic year, if any.
func activeSchoolYear(ctx context.Context, db *sql.DB) (string, bool) {
	var name string
	if err := db.QueryRowContext(ctx,
		`SELECT name FROM school_years WHERE is_active = 1 LIMIT 1`).Scan(&name); err != nil {
		return "", false
	}
	return name, true
}

// schoolYearExists reports whether name is one of the catalog's years.
func schoolYearExists(ctx context.Context, db *sql.DB, name string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM school_years WHERE name = ?`, name).Scan(&count)
	return count > 0, err
}

// errUnknownSchoolYear means a subject named a year the catalog does not hold.
var errUnknownSchoolYear = errors.New("unknown school year")

// resolveSchoolYear validates the year a subject is scheduled into. An empty
// value inherits the current year, so a new subject lands in the year the
// school is actually running.
func resolveSchoolYear(ctx context.Context, db *sql.DB, raw string) (string, error) {
	year := strings.TrimSpace(raw)
	if year == "" {
		name, ok := activeSchoolYear(ctx, db)
		if !ok {
			return "", nil
		}
		return name, nil
	}
	exists, err := schoolYearExists(ctx, db, year)
	if err != nil {
		return "", err
	}
	if !exists {
		return "", errUnknownSchoolYear
	}
	return year, nil
}

// clearActiveYear demotes the current year so another one can take its place;
// the partial unique index allows a single active row, never two.
func clearActiveYear(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx,
		`UPDATE school_years SET is_active = 0, updated_at = ? WHERE is_active = 1`, util.Now())
	return err
}

// registerSchoolYears wires the academic calendar: list, create, edit,
// activate and remove. Subjects reference a year by name, so a rename follows
// through to the subjects and grade scales that use it.
func registerSchoolYears(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/school-years", listSchoolYears(db))
	mux.HandleFunc("POST /api/school-years", createSchoolYear(db))
	mux.HandleFunc("PATCH /api/school-years/{id}", patchSchoolYear(db))
	mux.HandleFunc("POST /api/school-years/{id}/activate", activateSchoolYear(db))
	mux.HandleFunc("DELETE /api/school-years/{id}", deleteSchoolYear(db))
}

func listSchoolYears(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.QueryContext(r.Context(), `
			SELECT y.id, y.name, COALESCE(y.starts_on, ''), COALESCE(y.ends_on, ''), y.is_active,
			       (SELECT COUNT(*) FROM subjects s WHERE s.school_year = y.name)
			FROM school_years y `+schoolYearOrder)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := schoolYearListOut{Items: []schoolYearOut{}}
		for rows.Next() {
			var y schoolYearOut
			if err := rows.Scan(&y.ID, &y.Name, &y.StartsOn, &y.EndsOn, &y.IsActive, &y.Subjects); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if y.IsActive {
				out.Active = y.Name
			}
			out.Items = append(out.Items, y)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func createSchoolYear(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var body struct {
			Name     string `json:"name"`
			StartsOn string `json:"starts_on"`
			EndsOn   string `json:"ends_on"`
			IsActive bool   `json:"is_active"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		name, ok := normalizeYearName(body.Name)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "a school year looks like 2026/2027",
			})
			return
		}
		startsOn, ok := normalizeYearDate(body.StartsOn)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "starts_on must be YYYY-MM-DD"})
			return
		}
		endsOn, ok := normalizeYearDate(body.EndsOn)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ends_on must be YYYY-MM-DD"})
			return
		}
		if startsOn != "" && endsOn != "" && startsOn > endsOn {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "starts_on is after ends_on"})
			return
		}

		exists, err := schoolYearExists(ctx, db, name)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if exists {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "that school year already exists"})
			return
		}

		// The first year on the books becomes the current one, so a fresh
		// install has a sensible default for new subjects.
		var total int
		if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM school_years`).Scan(&total); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		active := body.IsActive || total == 0

		id, now := util.NewID(), util.Now()
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if active {
			if err := clearActiveYear(ctx, tx); err != nil {
				_ = tx.Rollback()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO school_years (id, name, starts_on, ends_on, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, name, nullIfEmpty(startsOn), nullIfEmpty(endsOn), active, now, now); err != nil {
			_ = tx.Rollback()
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "that school year already exists"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusCreated, schoolYearOut{
			ID: id, Name: name, StartsOn: startsOn, EndsOn: endsOn, IsActive: active,
		})
	}
}

func patchSchoolYear(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")

		var body struct {
			Name     *string `json:"name"`
			StartsOn *string `json:"starts_on"`
			EndsOn   *string `json:"ends_on"`
			IsActive *bool   `json:"is_active"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var currentName string
		var currentStarts, currentEnds sql.NullString
		err := db.QueryRowContext(ctx,
			`SELECT name, starts_on, ends_on FROM school_years WHERE id = ?`, id).
			Scan(&currentName, &currentStarts, &currentEnds)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "school year not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var b setBuilder
		newName := currentName
		if body.Name != nil {
			name, ok := normalizeYearName(*body.Name)
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "a school year looks like 2026/2027",
				})
				return
			}
			if name != currentName {
				exists, err := schoolYearExists(ctx, db, name)
				if err != nil {
					writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
					return
				}
				if exists {
					writeJSON(w, http.StatusConflict, map[string]string{"error": "that school year already exists"})
					return
				}
				newName = name
				b.set("name", name)
			}
		}

		startsOn := currentStarts.String
		if body.StartsOn != nil {
			date, ok := normalizeYearDate(*body.StartsOn)
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "starts_on must be YYYY-MM-DD"})
				return
			}
			startsOn = date
			b.set("starts_on", nullIfEmpty(date))
		}
		endsOn := currentEnds.String
		if body.EndsOn != nil {
			date, ok := normalizeYearDate(*body.EndsOn)
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ends_on must be YYYY-MM-DD"})
				return
			}
			endsOn = date
			b.set("ends_on", nullIfEmpty(date))
		}
		if startsOn != "" && endsOn != "" && startsOn > endsOn {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "starts_on is after ends_on"})
			return
		}

		activate := body.IsActive != nil && *body.IsActive
		if body.IsActive != nil && !*body.IsActive {
			b.set("is_active", 0)
		} else if activate {
			b.set("is_active", 1)
		}

		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}
		b.set("updated_at", util.Now())

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if activate {
			if err := clearActiveYear(ctx, tx); err != nil {
				_ = tx.Rollback()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		if newName != currentName {
			// Subjects and grade scales carry the year by name: follow the rename
			// so no record is left pointing at a year that no longer exists.
			if _, err := tx.ExecContext(ctx,
				`UPDATE subjects SET school_year = ?, updated_at = ? WHERE school_year = ?`,
				newName, util.Now(), currentName); err != nil {
				_ = tx.Rollback()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if _, err := tx.ExecContext(ctx,
				`UPDATE grade_scales SET school_year = ?, updated_at = ? WHERE school_year = ?`,
				newName, util.Now(), currentName); err != nil {
				_ = tx.Rollback()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}

		args := append(append([]any{}, b.args...), id)
		if _, err := tx.ExecContext(ctx,
			`UPDATE school_years SET `+strings.Join(b.sets, ", ")+` WHERE id = ?`, args...); err != nil {
			_ = tx.Rollback()
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "that school year already exists"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func activateSchoolYear(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")

		if !rowExists(ctx, db, "school_years", id) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "school year not found"})
			return
		}
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := clearActiveYear(ctx, tx); err != nil {
			_ = tx.Rollback()
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE school_years SET is_active = 1, updated_at = ? WHERE id = ?`, util.Now(), id); err != nil {
			_ = tx.Rollback()
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteSchoolYear(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")

		var name string
		var isActive bool
		err := db.QueryRowContext(ctx,
			`SELECT name, is_active FROM school_years WHERE id = ?`, id).Scan(&name, &isActive)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "school year not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if isActive {
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": "the current school year cannot be removed; activate another year first",
			})
			return
		}

		var subjects int
		if err := db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM subjects WHERE school_year = ?`, name).Scan(&subjects); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if subjects > 0 {
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": "subjects still belong to this school year",
			})
			return
		}

		if _, err := db.ExecContext(ctx, `DELETE FROM school_years WHERE id = ?`, id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
