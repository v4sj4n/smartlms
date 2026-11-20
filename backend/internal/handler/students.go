package handler

import (
	"database/sql"
	"net/http"
	"sort"
	"strconv"
	"strings"
)

// studentRowOut is one row of the student list: the account, the programme the
// student is admitted to (their current admission, or the latest one when none
// is active) and the headline numbers from their study record.
type studentRowOut struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Email         string   `json:"email"`
	ProgrammeID   string   `json:"programme_id,omitempty"`
	ProgrammeName string   `json:"programme_name,omitempty"`
	ProgrammeCode string   `json:"programme_code,omitempty"`
	YearOfStudy   int      `json:"year_of_study,omitempty"`
	AdmittedIn    string   `json:"admitted_in,omitempty"`
	Status        string   `json:"status,omitempty"`
	GPA           *float64 `json:"gpa"`
	CreditsEarned float64  `json:"credits_earned"`
}

// GET /api/students — staff list of students, filterable by programme, year of
// study, the school year they were admitted in, admission status and GPA.
//
// Query: search, programme_id, year_of_study, admitted_in, status
// (ACTIVE|SUSPENDED|GRADUATED|WITHDRAWN|UNPLACED), gpa_min, gpa_max,
// sort (name|gpa|year|admitted|credits), order (asc|desc), page, page_size.
func registerStudents(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/students", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query()
		page, size := pagination(r)

		where := []string{"r.name = 'STUDENT'"}
		args := []any{}
		if search := strings.TrimSpace(q.Get("search")); search != "" {
			where = append(where, "(u.name LIKE ? OR u.email LIKE ?)")
			like := "%" + search + "%"
			args = append(args, like, like)
		}
		if v := q.Get("programme_id"); v != "" {
			where = append(where, "e.programme_id = ?")
			args = append(args, v)
		}
		if v, err := strconv.Atoi(q.Get("year_of_study")); err == nil && v > 0 {
			where = append(where, "e.year_of_study = ?")
			args = append(args, v)
		}
		if v := q.Get("admitted_in"); v != "" {
			where = append(where, "e.school_year = ?")
			args = append(args, v)
		}
		switch status := strings.ToUpper(q.Get("status")); status {
		case "":
		case "UNPLACED":
			where = append(where, "e.id IS NULL")
		default:
			where = append(where, "e.status = ?")
			args = append(args, status)
		}

		// Each student's admission: the active one, else the most recent.
		rows, err := db.QueryContext(ctx, `
			SELECT u.id, u.name, u.email,
			       COALESCE(e.programme_id, ''), COALESCE(p.name, ''), COALESCE(p.code, ''),
			       COALESCE(e.year_of_study, 0), COALESCE(e.school_year, ''), COALESCE(e.status, '')
			FROM users u
			JOIN roles r ON r.id = u.role_id
			LEFT JOIN programme_enrollments e ON e.id = (
			  SELECT x.id FROM programme_enrollments x WHERE x.student_id = u.id
			  ORDER BY (x.status = 'ACTIVE') DESC, x.enrolled_at DESC LIMIT 1)
			LEFT JOIN programmes p ON p.id = e.programme_id
			WHERE `+strings.Join(where, " AND ")+`
			ORDER BY u.name`, args...)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		students := []studentRowOut{}
		for rows.Next() {
			var s studentRowOut
			if err := rows.Scan(&s.ID, &s.Name, &s.Email, &s.ProgrammeID, &s.ProgrammeName,
				&s.ProgrammeCode, &s.YearOfStudy, &s.AdmittedIn, &s.Status); err != nil {
				rows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			students = append(students, s)
		}
		rows.Close()

		// GPA comes from the same calculation as the study card, so filtering and
		// sorting by it happen here rather than in SQL.
		gpaMin, hasMin := parseFloat(q.Get("gpa_min"))
		gpaMax, hasMax := parseFloat(q.Get("gpa_max"))
		filtered := students[:0]
		for _, s := range students {
			record, err := buildStudentRecord(ctx, db, s.ID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			s.GPA = record.GPA
			s.CreditsEarned = record.CreditsEarned
			if (hasMin || hasMax) && s.GPA == nil {
				continue
			}
			if hasMin && *s.GPA < gpaMin || hasMax && *s.GPA > gpaMax {
				continue
			}
			filtered = append(filtered, s)
		}

		sortStudents(filtered, q.Get("sort"), q.Get("order") == "desc")

		total := len(filtered)
		from := min((page-1)*size, total)
		to := min(from+size, total)
		writeJSON(w, http.StatusOK, pageOut{Items: filtered[from:to], Total: total, Page: page, PageSize: size})
	})
}

func parseFloat(value string) (float64, bool) {
	if value == "" {
		return 0, false
	}
	parsed, err := strconv.ParseFloat(value, 64)
	return parsed, err == nil
}

// sortStudents orders the list by the chosen column. Students without a GPA
// always sink to the bottom, whichever direction is asked for.
func sortStudents(students []studentRowOut, by string, desc bool) {
	less := func(a, b studentRowOut) int {
		switch by {
		case "gpa":
			return compareFloat(gpaValue(a), gpaValue(b))
		case "credits":
			return compareFloat(a.CreditsEarned, b.CreditsEarned)
		case "year":
			return a.YearOfStudy - b.YearOfStudy
		case "admitted":
			return strings.Compare(a.AdmittedIn, b.AdmittedIn)
		}
		return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	}
	sort.SliceStable(students, func(i, j int) bool {
		a, b := students[i], students[j]
		if by == "gpa" && (a.GPA == nil) != (b.GPA == nil) {
			return a.GPA != nil
		}
		c := less(a, b)
		if desc {
			return c > 0
		}
		return c < 0
	})
}

func gpaValue(s studentRowOut) float64 {
	if s.GPA == nil {
		return 0
	}
	return *s.GPA
}

func compareFloat(a, b float64) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	}
	return 0
}
