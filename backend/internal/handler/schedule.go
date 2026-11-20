package handler

import (
	"database/sql"
	"net/http"
	"strings"
	"time"
)

// The timetable: one flat list of everything that has a time slot in a date
// range, whatever kind of session it is. Today only lectures carry a room and a
// lecturer, so every row comes from `lectures`; `kind` is on the wire so the
// union can grow (seminars, exams, office hours) without changing the contract.

// scheduleItemOut is one session on the timetable. The shape is what the
// Timetable screen reads, so the field names are part of the API.
type scheduleItemOut struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	// Kind is the sort of session this is. Only "lecture" exists today.
	Kind        string `json:"kind"`
	SubjectID   string `json:"subject_id"`
	SubjectName string `json:"subject_name"`
	SubjectCode string `json:"subject_code"`
	// StartsAt is RFC3339 in UTC. EndsAt is null: a lecture has no duration
	// stored yet, and the UI shows the start time alone.
	StartsAt string  `json:"starts_at"`
	EndsAt   *string `json:"ends_at"`
	// Room and LecturerName are null when the session has no room assigned or
	// the subject has no lecturer of record.
	Room         *string `json:"room"`
	LecturerName *string `json:"lecturer_name"`
}

// scheduleOut wraps the list: the schedule is always read as a whole range, and
// a named field keeps room for the range metadata the screen may want later.
type scheduleOut struct {
	Sessions []scheduleItemOut `json:"sessions"`
}

// registerSchedule wires GET /api/schedule — the caller's timetable for a date
// range, defaulting to the current week.
func registerSchedule(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/schedule", listSchedule(db))
}

// parseScheduleDay reads a YYYY-MM-DD query value. An empty value is reported as
// missing, not as an error; garbage is an error the handler turns into a 400.
func parseScheduleDay(value string) (time.Time, bool, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Time{}, false, nil
	}
	day, err := time.Parse(isoDay, trimmed)
	if err != nil {
		return time.Time{}, false, err
	}
	return day, true, nil
}

// scheduleWeek is the Monday-to-Sunday week a moment falls in, the way a
// timetable is read.
func scheduleWeek(now time.Time) (time.Time, time.Time) {
	utc := now.UTC()
	offset := (int(utc.Weekday()) + 6) % 7 // Monday = 0 ... Sunday = 6
	monday := time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -offset)
	return monday, monday.AddDate(0, 0, 6)
}

// scheduleInstant normalises a stored timestamp to UTC RFC3339 so the frontend
// parses one format. A value SQLite cannot read back is passed through as it is.
func scheduleInstant(raw string) string {
	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return parsed.UTC().Format(time.RFC3339)
	}
	return raw
}

func listSchedule(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// The range defaults to the current week in UTC; each bound can be given
		// on its own, and the missing one keeps its default.
		from, to := scheduleWeek(time.Now())
		fromRaw, hasFrom, err := parseScheduleDay(r.URL.Query().Get("from"))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "from must be a date (YYYY-MM-DD)"})
			return
		}
		toRaw, hasTo, err := parseScheduleDay(r.URL.Query().Get("to"))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to must be a date (YYYY-MM-DD)"})
			return
		}
		if hasFrom {
			from = fromRaw
		}
		if hasTo {
			to = toRaw
		}

		// date() reads the stored ISO timestamps in UTC and yields NULL for a
		// value it cannot parse, so a half-written row never lands in a range.
		rows, err := db.QueryContext(ctx, `
			SELECT l.id, l.title, l.scheduled_at,
			       s.id, s.name, COALESCE(s.code, ''),
			       cl.name, u.name
			FROM lectures l
			JOIN subjects s ON s.id = l.subject_id
			LEFT JOIN classes cl ON cl.id = l.class_id
			LEFT JOIN users u ON u.id = s.lecturer_id
			WHERE l.scheduled_at IS NOT NULL
			  AND date(l.scheduled_at) BETWEEN ? AND ?
			ORDER BY l.scheduled_at, s.name`, from.Format(isoDay), to.Format(isoDay))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		out := scheduleOut{Sessions: []scheduleItemOut{}}
		for rows.Next() {
			var item scheduleItemOut
			var scheduledAt string
			var room, lecturer sql.NullString
			if err := rows.Scan(&item.ID, &item.Title, &scheduledAt,
				&item.SubjectID, &item.SubjectName, &item.SubjectCode,
				&room, &lecturer); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			item.Kind = "lecture"
			item.StartsAt = scheduleInstant(scheduledAt)
			if room.Valid {
				item.Room = &room.String
			}
			if lecturer.Valid {
				item.LecturerName = &lecturer.String
			}
			out.Sessions = append(out.Sessions, item)
		}
		writeJSON(w, http.StatusOK, out)
	}
}
