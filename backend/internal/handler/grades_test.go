package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"optimolms/backend/internal/util"
)

// gradedSubject is a subject the demo lecturer teaches, with one assignment the
// tests can hang a grade component on.
type gradedSubject struct {
	subjectID    string
	assignmentID string
	title        string
	maxPoints    int
	studentID    string
}

func seededGradedSubject(t *testing.T, api *authAPI) gradedSubject {
	t.Helper()
	ctx := context.Background()

	var subjectID string
	if err := api.db.QueryRowContext(ctx,
		`SELECT id FROM subjects WHERE lecturer_id = ? ORDER BY code LIMIT 1`, api.users["LECTURER"]).
		Scan(&subjectID); err != nil {
		t.Fatalf("seeded subject: %v", err)
	}

	recorder := api.asRole("LECTURER", http.MethodPost, "/api/subjects/"+subjectID+"/assignments",
		map[string]any{"title": "Chain rule worksheet", "max_points": 40, "submission_type": "both"})
	if recorder.Code != http.StatusCreated && recorder.Code != http.StatusOK {
		t.Fatalf("create assignment: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var assignment struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		MaxPoints int    `json:"max_points"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&assignment); err != nil {
		t.Fatalf("decode assignment: %v", err)
	}

	studentID := api.users["STUDENT"]
	if _, err := api.db.ExecContext(ctx,
		`INSERT INTO enrollments (id, student_id, subject_id, enrolled_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT (student_id, subject_id) DO NOTHING`,
		util.NewID(), studentID, subjectID, util.Now()); err != nil {
		t.Fatalf("enroll student: %v", err)
	}

	return gradedSubject{
		subjectID:    subjectID,
		assignmentID: assignment.ID,
		title:        assignment.Title,
		maxPoints:    assignment.MaxPoints,
		studentID:    studentID,
	}
}

// gradebook is the shape the lecturer UI reads.
type gradebookPayload struct {
	Components []struct {
		ID           string  `json:"id"`
		Name         string  `json:"name"`
		Type         string  `json:"type"`
		Weight       float64 `json:"weight_percent"`
		MaxPoints    int     `json:"max_points"`
		AssignmentID *string `json:"assignment_id"`
	} `json:"components"`
	Students []struct {
		ID     string              `json:"id"`
		Points map[string]*float64 `json:"points"`
	} `json:"students"`
}

func (api *authAPI) readGradebook(t *testing.T, subjectID string) gradebookPayload {
	t.Helper()
	recorder := api.asRole("LECTURER", http.MethodGet, "/api/subjects/"+subjectID+"/gradebook", nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("gradebook: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var payload gradebookPayload
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("decode gradebook: %v", err)
	}
	return payload
}

func TestAssignmentBecomesAGradeComponent(t *testing.T) {
	api := newAuthAPI(t)
	fixture := seededGradedSubject(t, api)

	recorder := api.asRole("LECTURER", http.MethodPost,
		"/api/subjects/"+fixture.subjectID+"/grade-components",
		map[string]any{"assignment_id": fixture.assignmentID, "weight_percent": 25})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create component: status %d body %s", recorder.Code, recorder.Body.String())
	}

	var created struct {
		ID           string  `json:"id"`
		Name         string  `json:"name"`
		Type         string  `json:"type"`
		MaxPoints    int     `json:"max_points"`
		AssignmentID *string `json:"assignment_id"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&created); err != nil {
		t.Fatalf("decode component: %v", err)
	}
	if created.Name != fixture.title {
		t.Errorf("component name = %q, want the assignment title %q", created.Name, fixture.title)
	}
	if created.MaxPoints != fixture.maxPoints {
		t.Errorf("max points = %d, want the assignment's %d", created.MaxPoints, fixture.maxPoints)
	}
	if created.Type != "assignment" {
		t.Errorf("type = %q, want assignment", created.Type)
	}
	if created.AssignmentID == nil || *created.AssignmentID != fixture.assignmentID {
		t.Errorf("assignment link not stored: %v", created.AssignmentID)
	}

	// One assignment counts once: a second attempt is a conflict, not a copy.
	again := api.asRole("LECTURER", http.MethodPost,
		"/api/subjects/"+fixture.subjectID+"/grade-components",
		map[string]any{"assignment_id": fixture.assignmentID, "weight_percent": 10})
	if again.Code != http.StatusConflict {
		t.Fatalf("duplicate link: status %d, want 409", again.Code)
	}
}

func TestAssignmentPointsAndGradebookStayInStep(t *testing.T) {
	api := newAuthAPI(t)
	fixture := seededGradedSubject(t, api)

	recorder := api.asRole("LECTURER", http.MethodPost,
		"/api/subjects/"+fixture.subjectID+"/grade-components",
		map[string]any{"assignment_id": fixture.assignmentID, "weight_percent": 100})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create component: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var component struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&component); err != nil {
		t.Fatalf("decode component: %v", err)
	}

	// A submitted assignment the lecturer then grades.
	submissionID := util.NewID()
	now := util.Now()
	if _, err := api.db.ExecContext(t.Context(),
		`INSERT INTO assignment_submissions (id, assignment_id, student_id, content, status, submitted_at, updated_at)
		 VALUES (?, ?, ?, 'my worksheet', 'submitted', ?, ?)`,
		submissionID, fixture.assignmentID, fixture.studentID, now, now); err != nil {
		t.Fatalf("insert submission: %v", err)
	}

	graded := api.asRole("LECTURER", http.MethodPatch, "/api/submissions/"+submissionID,
		map[string]any{"score": 34})
	if graded.Code != http.StatusOK {
		t.Fatalf("grade submission: status %d body %s", graded.Code, graded.Body.String())
	}
	if got := componentPoints(t, api, fixture, component.ID); got != 34 {
		t.Errorf("gradebook points after grading = %v, want 34", got)
	}

	// Typing the points in the gradebook updates the submission, not just the
	// component, so both screens show the same number.
	entry := api.asRole("LECTURER", http.MethodPut,
		"/api/grade-components/"+component.ID+"/entries/"+fixture.studentID,
		map[string]any{"points": 21})
	if entry.Code != http.StatusNoContent {
		t.Fatalf("save entry: status %d body %s", entry.Code, entry.Body.String())
	}
	var score *float64
	var status string
	if err := api.db.QueryRowContext(t.Context(),
		`SELECT score, status FROM assignment_submissions WHERE id = ?`, submissionID).
		Scan(&score, &status); err != nil {
		t.Fatalf("read submission: %v", err)
	}
	if score == nil || *score != 21 {
		t.Errorf("submission score = %v, want 21", score)
	}
	if status != "graded" {
		t.Errorf("submission status = %q, want graded", status)
	}
}

func componentPoints(t *testing.T, api *authAPI, fixture gradedSubject, componentID string) float64 {
	t.Helper()
	book := api.readGradebook(t, fixture.subjectID)
	for _, student := range book.Students {
		if student.ID != fixture.studentID {
			continue
		}
		if points := student.Points[componentID]; points != nil {
			return *points
		}
		return -1
	}
	t.Fatalf("student %s is not in the gradebook", fixture.studentID)
	return -1
}
