package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"optimolms/backend/internal/util"
)

// Course enrolment: who sits in a subject. The roster is the set of
// `enrollments` rows of one subject, read together with the account it points
// at, so the screen never has to resolve ids itself.
//
// Everything here is a staff operation: the route policy in session.go asks for
// subjects.view to read the roster and subjects.manage to change it, which is
// what keeps a student from enrolling classmates.

// enrollmentOut is one person on a subject's roster.
type enrollmentOut struct {
	EnrollmentID string `json:"enrollment_id"`
	StudentID    string `json:"student_id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	EnrolledAt   string `json:"enrolled_at"`
}

// subjectRosterOut is the whole roster. A named field keeps the response
// extensible (a count, the subject's own name) without breaking the client.
type subjectRosterOut struct {
	Enrolled []enrollmentOut `json:"enrolled"`
}

// registerSubjectEnrollments wires the roster endpoints under a subject.
func registerSubjectEnrollments(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/subjects/{id}/enrollments", listSubjectEnrollments(db))
	mux.HandleFunc("POST /api/subjects/{id}/enrollments", enrollStudents(db))
	mux.HandleFunc("DELETE /api/subjects/{id}/enrollments/{studentId}", unenrollStudent(db))
}

// queryRunner is what the roster reader needs: *sql.DB outside a transaction,
// *sql.Tx inside one.
type queryRunner interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// readSubjectRoster returns the enrolled students, ordered by name — the order
// the roster screen shows them in.
func readSubjectRoster(ctx context.Context, runner queryRunner, subjectID string) ([]enrollmentOut, error) {
	rows, err := runner.QueryContext(ctx, `
		SELECT e.id, u.id, u.name, u.email, e.enrolled_at
		FROM enrollments e
		JOIN users u ON u.id = e.student_id
		WHERE e.subject_id = ?
		ORDER BY u.name, u.email`, subjectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	roster := []enrollmentOut{}
	for rows.Next() {
		var row enrollmentOut
		if err := rows.Scan(&row.EnrollmentID, &row.StudentID, &row.Name, &row.Email, &row.EnrolledAt); err != nil {
			return nil, err
		}
		roster = append(roster, row)
	}
	return roster, rows.Err()
}

// GET /api/subjects/{id}/enrollments — the roster of a subject.
func listSubjectEnrollments(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		subjectID := r.PathValue("id")
		if !rowExists(ctx, db, "subjects", subjectID) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		roster, err := readSubjectRoster(ctx, db, subjectID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, subjectRosterOut{Enrolled: roster})
	}
}

// POST /api/subjects/{id}/enrollments — add students in bulk and answer with
// the roster as it stands afterwards, so the screen needs one call.
//
// All or nothing: every id must name an existing account whose role is STUDENT,
// and one bad id leaves the roster untouched. Ids already enrolled are not an
// error — re-posting a list is how a screen "saves" it.
func enrollStudents(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		subjectID := r.PathValue("id")

		var body struct {
			StudentIDs []string `json:"student_ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		// Duplicates inside one request collapse: the second insert would be
		// ignored anyway, and each id is validated once.
		wanted := make([]string, 0, len(body.StudentIDs))
		seen := make(map[string]struct{}, len(body.StudentIDs))
		for _, raw := range body.StudentIDs {
			id := strings.TrimSpace(raw)
			if id == "" {
				continue
			}
			if _, dup := seen[id]; dup {
				continue
			}
			seen[id] = struct{}{}
			wanted = append(wanted, id)
		}
		if len(wanted) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "student_ids is required"})
			return
		}
		if !rowExists(ctx, db, "subjects", subjectID) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer tx.Rollback() //nolint:errcheck // no-op after Commit

		now := util.Now()
		for _, studentID := range wanted {
			var role string
			err := tx.QueryRowContext(ctx,
				`SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
				studentID).Scan(&role)
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown user " + studentID})
				return
			}
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if role != "STUDENT" {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "only students can be enrolled; " + studentID + " is a " + role,
				})
				return
			}
			if _, err := tx.ExecContext(ctx,
				`INSERT OR IGNORE INTO enrollments (id, student_id, subject_id, enrolled_at) VALUES (?, ?, ?, ?)`,
				util.NewID(), studentID, subjectID, now); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}

		roster, err := readSubjectRoster(ctx, tx, subjectID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, subjectRosterOut{Enrolled: roster})
	}
}

// DELETE /api/subjects/{id}/enrollments/{studentId} — take one student off the
// roster. Their submissions and grades stay: the grade history outlives the
// enrolment row.
func unenrollStudent(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(),
			`DELETE FROM enrollments WHERE subject_id = ? AND student_id = ?`,
			r.PathValue("id"), r.PathValue("studentId"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "student is not enrolled in this subject"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
