package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"optimolms/backend/internal/util"
)

// Weeks lay a subject out the way a student reads it: week 1, week 2, ... with
// the content taught in each. A school year runs in two seasons (fall and
// summer), and a subject belongs to one of them.

const isoDay = "2006-01-02"

// weekItemOut is one piece of content inside a week: a lecture, an assignment,
// a quiz or a flashcard set.
type weekItemOut struct {
	ID    string `json:"id"`
	Kind  string `json:"kind"` // lecture | assignment | quiz | flashcard (a set)
	Title string `json:"title"`
	// Lecture/assignment dates, so the week reads chronologically.
	ScheduledAt string `json:"scheduled_at,omitempty"`
	DueAt       string `json:"due_at,omitempty"`
}

type weekOut struct {
	ID          string        `json:"id"`
	SubjectID   string        `json:"subject_id"`
	SchoolYear  string        `json:"school_year,omitempty"`
	Season      string        `json:"season"`
	WeekNumber  int           `json:"week_number"`
	Title       string        `json:"title,omitempty"`
	Description string        `json:"description,omitempty"`
	StartsOn    string        `json:"starts_on,omitempty"`
	EndsOn      string        `json:"ends_on,omitempty"`
	Items       []weekItemOut `json:"items"`
}

// weeksOut is one subject's whole calendar: its weeks plus the content that is
// not in a week yet, so nothing silently disappears from the page.
type weeksOut struct {
	SubjectID   string        `json:"subject_id"`
	SubjectName string        `json:"subject_name"`
	SchoolYear  string        `json:"school_year,omitempty"`
	Season      string        `json:"season"`
	Weeks       []weekOut     `json:"weeks"`
	Unscheduled []weekItemOut `json:"unscheduled"`
}

// normaliseSeason validates a season, defaulting to the subject's own half of
// the year (semester I is the fall term, semester II the summer term).
func normaliseSeason(raw, subjectSemester string) (string, bool) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "":
		if subjectSemester == "SECOND" {
			return "SUMMER", true
		}
		return "FALL", true
	case "FALL", "SUMMER":
		return strings.ToUpper(strings.TrimSpace(raw)), true
	default:
		return "", false
	}
}

// normaliseWeekDates validates the bounds of a week. One bound is enough: the
// missing end is the sixth day after the start.
func normaliseWeekDates(startsOn, endsOn string) (string, string, string) {
	startRaw, endRaw := strings.TrimSpace(startsOn), strings.TrimSpace(endsOn)

	var start, end time.Time
	var hasStart, hasEnd bool
	if startRaw != "" {
		parsed, err := time.Parse(isoDay, startRaw)
		if err != nil {
			return "", "", "starts_on must be YYYY-MM-DD"
		}
		start, hasStart = parsed, true
	}
	if endRaw != "" {
		parsed, err := time.Parse(isoDay, endRaw)
		if err != nil {
			return "", "", "ends_on must be YYYY-MM-DD"
		}
		end, hasEnd = parsed, true
	}

	switch {
	case hasStart && hasEnd:
		if end.Before(start) {
			return "", "", "the week ends before it starts"
		}
	case hasStart:
		end = start.AddDate(0, 0, 6)
	case hasEnd:
		start = end.AddDate(0, 0, -6)
	default:
		return "", "", ""
	}
	return start.Format(isoDay), end.Format(isoDay), ""
}

// weekNumberFree reports whether a week number is still unused in the subject's
// season for that school year.
func weekNumberFree(ctx context.Context, db *sql.DB, subjectID, schoolYear, season string, weekNumber int, ignoreID string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM course_weeks
		WHERE subject_id = ? AND COALESCE(school_year, '') = ? AND season = ?
		  AND week_number = ? AND id <> ?`,
		subjectID, schoolYear, season, weekNumber, ignoreID).Scan(&count)
	return count == 0, err
}

// nextWeekNumber is the number "add week" starts from: one past the last week
// of the season.
func nextWeekNumber(ctx context.Context, db *sql.DB, subjectID, schoolYear, season string) (int, error) {
	var last sql.NullInt64
	err := db.QueryRowContext(ctx, `
		SELECT MAX(week_number) FROM course_weeks
		WHERE subject_id = ? AND COALESCE(school_year, '') = ? AND season = ?`,
		subjectID, schoolYear, season).Scan(&last)
	if err != nil {
		return 0, err
	}
	if !last.Valid {
		return 1, nil
	}
	return int(last.Int64) + 1, nil
}

// weekPlacement validates that a week belongs to a subject and returns the value
// to store: the week id, or nil for "not scheduled into a week yet".
func weekPlacement(ctx context.Context, db *sql.DB, subjectID, weekID string) (any, string) {
	weekID = strings.TrimSpace(weekID)
	if weekID == "" {
		return nil, ""
	}
	var owner string
	if err := db.QueryRowContext(ctx,
		`SELECT subject_id FROM course_weeks WHERE id = ?`, weekID).Scan(&owner); err != nil {
		return nil, "unknown week"
	}
	if owner != subjectID {
		return nil, "that week belongs to another subject"
	}
	return weekID, ""
}

// subjectOf is the subject a content row belongs to. Tables are internal
// constants, never user input.
func subjectOf(ctx context.Context, db *sql.DB, table, id string) (string, bool) {
	var subjectID string
	err := db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT subject_id FROM %s WHERE id = ?`, table), id).Scan(&subjectID)
	if err != nil {
		return "", false
	}
	return subjectID, true
}

// registerWeeks wires the week-by-week view of a subject.
func registerWeeks(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/subjects/{id}/weeks", listWeeks(db))
	mux.HandleFunc("POST /api/subjects/{id}/weeks", createWeek(db))
	mux.HandleFunc("PATCH /api/weeks/{id}", patchWeek(db))
	mux.HandleFunc("DELETE /api/weeks/{id}", deleteWeek(db))
}

func listWeeks(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		subjectID := r.PathValue("id")

		out := weeksOut{
			SubjectID:   subjectID,
			Weeks:       []weekOut{},
			Unscheduled: []weekItemOut{},
		}
		var semester string
		var schoolYear sql.NullString
		err := db.QueryRowContext(ctx,
			`SELECT name, semester, school_year FROM subjects WHERE id = ?`, subjectID).
			Scan(&out.SubjectName, &semester, &schoolYear)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		out.SchoolYear = schoolYear.String
		out.Season, _ = normaliseSeason("", semester)

		rows, err := db.QueryContext(ctx, `
			SELECT id, subject_id, COALESCE(school_year, ''), season, week_number,
			       COALESCE(title, ''), COALESCE(description, ''),
			       COALESCE(starts_on, ''), COALESCE(ends_on, '')
			FROM course_weeks WHERE subject_id = ?
			ORDER BY season, week_number`, subjectID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for rows.Next() {
			var week weekOut
			if err := rows.Scan(&week.ID, &week.SubjectID, &week.SchoolYear, &week.Season,
				&week.WeekNumber, &week.Title, &week.Description, &week.StartsOn, &week.EndsOn); err != nil {
				rows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			week.Items = []weekItemOut{}
			out.Weeks = append(out.Weeks, week)
		}
		rows.Close()

		items, err := subjectContent(ctx, db, subjectID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		byWeek := map[string][]weekItemOut{}
		for _, item := range items {
			if item.weekID == "" {
				out.Unscheduled = append(out.Unscheduled, item.weekItemOut)
				continue
			}
			byWeek[item.weekID] = append(byWeek[item.weekID], item.weekItemOut)
		}
		for index := range out.Weeks {
			if weekItems, ok := byWeek[out.Weeks[index].ID]; ok {
				out.Weeks[index].Items = weekItems
			}
		}

		writeJSON(w, http.StatusOK, out)
	}
}

// contentItem carries the item plus the week it sits in, so the listing can
// split scheduled from unscheduled content.
type contentItem struct {
	weekItemOut
	weekID string
}

// subjectContent reads every piece of content of a subject, in the order a week
// reads: lectures, assignments, quizzes, flashcard sets.
func subjectContent(ctx context.Context, db *sql.DB, subjectID string) ([]contentItem, error) {
	items := []contentItem{}

	lectureRows, err := db.QueryContext(ctx, `
		SELECT id, title, COALESCE(scheduled_at, ''), COALESCE(week_id, '')
		FROM lectures WHERE subject_id = ? ORDER BY scheduled_at, title`, subjectID)
	if err != nil {
		return nil, err
	}
	for lectureRows.Next() {
		var item contentItem
		if err := lectureRows.Scan(&item.ID, &item.Title, &item.ScheduledAt, &item.weekID); err != nil {
			lectureRows.Close()
			return nil, err
		}
		item.Kind = "lecture"
		items = append(items, item)
	}
	lectureRows.Close()

	assignmentRows, err := db.QueryContext(ctx, `
		SELECT id, title, COALESCE(scheduled_at, ''), COALESCE(due_at, ''), COALESCE(week_id, '')
		FROM assignments WHERE subject_id = ? ORDER BY due_at IS NULL, due_at, title`, subjectID)
	if err != nil {
		return nil, err
	}
	for assignmentRows.Next() {
		var item contentItem
		if err := assignmentRows.Scan(&item.ID, &item.Title, &item.ScheduledAt, &item.DueAt, &item.weekID); err != nil {
			assignmentRows.Close()
			return nil, err
		}
		item.Kind = "assignment"
		items = append(items, item)
	}
	assignmentRows.Close()

	quizRows, err := db.QueryContext(ctx, `
		SELECT id, title, COALESCE(week_id, '') FROM quizzes WHERE subject_id = ? ORDER BY title`, subjectID)
	if err != nil {
		return nil, err
	}
	for quizRows.Next() {
		var item contentItem
		if err := quizRows.Scan(&item.ID, &item.Title, &item.weekID); err != nil {
			quizRows.Close()
			return nil, err
		}
		item.Kind = "quiz"
		items = append(items, item)
	}
	quizRows.Close()

	cardRows, err := db.QueryContext(ctx, `
		SELECT id, title, COALESCE(week_id, '') FROM flashcard_sets WHERE subject_id = ? ORDER BY created_at`, subjectID)
	if err != nil {
		return nil, err
	}
	for cardRows.Next() {
		var item contentItem
		if err := cardRows.Scan(&item.ID, &item.Title, &item.weekID); err != nil {
			cardRows.Close()
			return nil, err
		}
		item.Kind = "flashcard"
		items = append(items, item)
	}
	cardRows.Close()

	return items, nil
}

func createWeek(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		subjectID := r.PathValue("id")

		var body struct {
			SchoolYear  string `json:"school_year"`
			Season      string `json:"season"`
			WeekNumber  int    `json:"week_number"`
			Title       string `json:"title"`
			Description string `json:"description"`
			StartsOn    string `json:"starts_on"`
			EndsOn      string `json:"ends_on"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var semester string
		var subjectYear sql.NullString
		err := db.QueryRowContext(ctx,
			`SELECT semester, school_year FROM subjects WHERE id = ?`, subjectID).
			Scan(&semester, &subjectYear)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		season, ok := normaliseSeason(body.Season, semester)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "season must be FALL or SUMMER"})
			return
		}

		// The week belongs to the year the subject runs in, unless the form names
		// another one.
		schoolYear := strings.TrimSpace(body.SchoolYear)
		if schoolYear == "" {
			schoolYear = subjectYear.String
		}
		resolvedYear, err := resolveSchoolYear(ctx, db, schoolYear)
		if err != nil {
			if err == errUnknownSchoolYear {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "unknown school year; add it under School years first",
				})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		weekNumber := body.WeekNumber
		if weekNumber == 0 {
			next, err := nextWeekNumber(ctx, db, subjectID, resolvedYear, season)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			weekNumber = next
		}
		if weekNumber < 1 || weekNumber > 30 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "a week number runs from 1 to 30"})
			return
		}

		startsOn, endsOn, problem := normaliseWeekDates(body.StartsOn, body.EndsOn)
		if problem != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
			return
		}

		free, err := weekNumberFree(ctx, db, subjectID, resolvedYear, season, weekNumber, "")
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !free {
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": fmt.Sprintf("week %d already exists in this season", weekNumber),
			})
			return
		}

		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO course_weeks (id, subject_id, school_year, season, week_number, title,
			                          description, starts_on, ends_on, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, subjectID, nullIfEmpty(resolvedYear), season, weekNumber,
			nullIfEmpty(body.Title), nullIfEmpty(body.Description),
			nullIfEmpty(startsOn), nullIfEmpty(endsOn), now, now); err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{
					"error": fmt.Sprintf("week %d already exists in this season", weekNumber),
				})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusCreated, weekOut{
			ID: id, SubjectID: subjectID, SchoolYear: resolvedYear, Season: season,
			WeekNumber: weekNumber, Title: strings.TrimSpace(body.Title),
			Description: strings.TrimSpace(body.Description),
			StartsOn:    startsOn, EndsOn: endsOn, Items: []weekItemOut{},
		})
	}
}

func patchWeek(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		id := r.PathValue("id")

		var body struct {
			SchoolYear  *string `json:"school_year"`
			Season      *string `json:"season"`
			WeekNumber  *int    `json:"week_number"`
			Title       *string `json:"title"`
			Description *string `json:"description"`
			StartsOn    *string `json:"starts_on"`
			EndsOn      *string `json:"ends_on"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		var subjectID, season string
		var schoolYear, startsOn, endsOn sql.NullString
		var weekNumber int
		err := db.QueryRowContext(ctx, `
			SELECT subject_id, COALESCE(school_year, ''), season, week_number,
			       starts_on, ends_on
			FROM course_weeks WHERE id = ?`, id).
			Scan(&subjectID, &schoolYear, &season, &weekNumber, &startsOn, &endsOn)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "week not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		var semester string
		if err := db.QueryRowContext(ctx,
			`SELECT semester FROM subjects WHERE id = ?`, subjectID).Scan(&semester); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		var b setBuilder
		effectiveYear := schoolYear.String
		if body.SchoolYear != nil {
			year, err := resolveSchoolYear(ctx, db, *body.SchoolYear)
			if err != nil {
				if err == errUnknownSchoolYear {
					writeJSON(w, http.StatusBadRequest, map[string]string{
						"error": "unknown school year; add it under School years first",
					})
					return
				}
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			effectiveYear = year
			b.set("school_year", nullIfEmpty(year))
		}

		effectiveSeason := season
		if body.Season != nil {
			normalised, ok := normaliseSeason(*body.Season, semester)
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "season must be FALL or SUMMER"})
				return
			}
			effectiveSeason = normalised
			b.set("season", normalised)
		}

		effectiveNumber := weekNumber
		if body.WeekNumber != nil {
			if *body.WeekNumber < 1 || *body.WeekNumber > 30 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "a week number runs from 1 to 30"})
				return
			}
			effectiveNumber = *body.WeekNumber
			b.set("week_number", *body.WeekNumber)
		}

		if body.StartsOn != nil || body.EndsOn != nil {
			nextStarts, nextEnds := startsOn.String, endsOn.String
			if body.StartsOn != nil {
				nextStarts = *body.StartsOn
			}
			if body.EndsOn != nil {
				nextEnds = *body.EndsOn
			}
			normalisedStart, normalisedEnd, problem := normaliseWeekDates(nextStarts, nextEnds)
			if problem != "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
				return
			}
			b.set("starts_on", nullIfEmpty(normalisedStart))
			b.set("ends_on", nullIfEmpty(normalisedEnd))
		}

		if body.Title != nil {
			b.set("title", nullIfEmpty(*body.Title))
		}
		if body.Description != nil {
			b.set("description", nullIfEmpty(*body.Description))
		}
		if b.empty() {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}

		free, err := weekNumberFree(ctx, db, subjectID, effectiveYear, effectiveSeason, effectiveNumber, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !free {
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": fmt.Sprintf("week %d already exists in this season", effectiveNumber),
			})
			return
		}

		if _, err := b.updateRow(ctx, db, "course_weeks", id); err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "that week already exists"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func deleteWeek(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Content keeps existing: the foreign key clears week_id.
		res, err := db.ExecContext(r.Context(),
			`DELETE FROM course_weeks WHERE id = ?`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "week not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
