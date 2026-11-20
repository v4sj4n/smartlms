package handler

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

// schedulePayload is GET /api/schedule as the Timetable screen reads it.
type schedulePayload struct {
	Sessions []struct {
		ID           string  `json:"id"`
		Title        string  `json:"title"`
		Kind         string  `json:"kind"`
		SubjectID    string  `json:"subject_id"`
		SubjectName  string  `json:"subject_name"`
		SubjectCode  string  `json:"subject_code"`
		StartsAt     string  `json:"starts_at"`
		EndsAt       *string `json:"ends_at"`
		Room         *string `json:"room"`
		LecturerName *string `json:"lecturer_name"`
	} `json:"sessions"`
}

// readScheduleOut performs the timetable request as the given role.
func (api *authAPI) readScheduleOut(t *testing.T, role, query string) schedulePayload {
	t.Helper()
	recorder := api.asRole(role, http.MethodGet, "/api/schedule"+query, nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("schedule %s: status %d body %s", query, recorder.Code, recorder.Body.String())
	}
	var payload schedulePayload
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("decode schedule: %v", err)
	}
	return payload
}

// newScheduleSubject creates a subject through the API (the seed only teaches
// one subject, and the ordering test needs a second name to sort).
func (api *authAPI) newScheduleSubject(t *testing.T, body map[string]any) string {
	t.Helper()
	recorder := api.asRole("ADMIN", http.MethodPost, "/api/subjects", body)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create subject: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&created); err != nil {
		t.Fatalf("decode subject: %v", err)
	}
	return created.ID
}

// scheduledLecture puts one lecture on the timetable through the API, the way
// the subject screen does.
func (api *authAPI) scheduledLecture(t *testing.T, subjectID string, body map[string]any) string {
	t.Helper()
	recorder := api.asRole("LECTURER", http.MethodPost, "/api/subjects/"+subjectID+"/lectures", body)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create lecture: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var lecture lectureOut
	if err := json.NewDecoder(recorder.Body).Decode(&lecture); err != nil {
		t.Fatalf("decode lecture: %v", err)
	}
	return lecture.ID
}

// roomID resolves a seeded room by name, so the test does not invent ids.
func (api *authAPI) roomID(t *testing.T, name string) string {
	t.Helper()
	var id string
	if err := api.db.QueryRow(`SELECT id FROM classes WHERE name = ?`, name).Scan(&id); err != nil {
		t.Fatalf("room %s: %v", name, err)
	}
	return id
}

func (api *authAPI) subjectIDByCode(t *testing.T, code string) string {
	t.Helper()
	var id string
	if err := api.db.QueryRow(`SELECT id FROM subjects WHERE code = ?`, code).Scan(&id); err != nil {
		t.Fatalf("subject %s: %v", code, err)
	}
	return id
}

// TestScheduleRangeFilteringOrdersAndJoins pins the contract of the timetable:
// only lectures inside [from, to], ordered by start and then subject name, with
// the room and the lecturer joined in, and null where they are missing.
func TestScheduleRangeFilteringOrdersAndJoins(t *testing.T) {
	api := newAuthAPI(t)
	mathsID := api.subjectIDByCode(t, "MATH101")

	// A second subject on the same slot as the seeded lecture, so the
	// subject-name tiebreak is exercised; it has no lecturer of record.
	algorithmsID := api.newScheduleSubject(t, map[string]any{"name": "Algorithms", "code": "ALG101"})
	api.scheduledLecture(t, algorithmsID, map[string]any{
		"title": "Sorting", "scheduled_at": "2026-11-23T09:00:00Z",
	})

	// In range, in a room, later in the week.
	roomID := api.roomID(t, "A101")
	inRoom := api.scheduledLecture(t, mathsID, map[string]any{
		"title": "Derivatives", "scheduled_at": "2026-11-24T11:00:00Z", "class_id": roomID,
	})
	// In range, no room.
	noRoom := api.scheduledLecture(t, mathsID, map[string]any{
		"title": "Problem session", "scheduled_at": "2026-11-25T13:00:00Z",
	})
	// Out of range on both sides.
	outsideLate := api.scheduledLecture(t, mathsID, map[string]any{
		"title": "December revision", "scheduled_at": "2026-12-01T09:00:00Z",
	})
	outsideEarly := api.scheduledLecture(t, mathsID, map[string]any{
		"title": "October kickoff", "scheduled_at": "2026-10-01T09:00:00Z",
	})
	// Never scheduled: it has no slot, so it is not a session.
	api.scheduledLecture(t, mathsID, map[string]any{"title": "Reading week"})

	payload := api.readScheduleOut(t, "STUDENT", "?from=2026-11-23&to=2026-11-29")
	if len(payload.Sessions) != 4 {
		t.Fatalf("want 4 sessions in the week, got %d: %+v", len(payload.Sessions), payload.Sessions)
	}

	// Same start time, so the subject name decides: Algorithms, then Mathematics.
	first := payload.Sessions[0]
	if first.Title != "Sorting" || first.SubjectName != "Algorithms" || first.SubjectCode != "ALG101" {
		t.Fatalf("first session should be Algorithms/Sorting, got %+v", first)
	}
	if first.Kind != "lecture" {
		t.Fatalf("kind: want lecture, got %q", first.Kind)
	}
	if first.StartsAt != "2026-11-23T09:00:00Z" {
		t.Fatalf("starts_at: want 2026-11-23T09:00:00Z, got %q", first.StartsAt)
	}
	if first.EndsAt != nil {
		t.Fatalf("ends_at: want null, got %v", *first.EndsAt)
	}
	if first.Room != nil {
		t.Fatalf("a session without a room must report null, got %q", *first.Room)
	}
	if first.LecturerName != nil {
		t.Fatalf("a subject without a lecturer must report null, got %q", *first.LecturerName)
	}

	second := payload.Sessions[1]
	if second.SubjectName != "Mathematics I" || second.Title != "Introduction to limits" {
		t.Fatalf("second session should be the seeded Mathematics lecture, got %+v", second)
	}
	if second.Room == nil || *second.Room != "B201" {
		t.Fatalf("room: want B201, got %v", second.Room)
	}
	if second.LecturerName == nil || *second.LecturerName != "Lecturer User" {
		t.Fatalf("lecturer: want Lecturer User, got %v", second.LecturerName)
	}

	third := payload.Sessions[2]
	if third.ID != inRoom || third.StartsAt != "2026-11-24T11:00:00Z" {
		t.Fatalf("third session should be the Tuesday lecture, got %+v", third)
	}
	if third.Room == nil || *third.Room != "A101" {
		t.Fatalf("room on the Tuesday lecture: want A101, got %v", third.Room)
	}

	// Thursday sorts last, and it is the one with no room assigned.
	fourth := payload.Sessions[3]
	if fourth.ID != noRoom || fourth.Room != nil {
		t.Fatalf("fourth session should be the room-less Thursday lecture, got %+v", fourth)
	}

	// The December and October lectures are outside the range and must not
	// appear, however convenient their titles look.
	for _, session := range payload.Sessions {
		if session.ID == outsideLate || session.ID == outsideEarly {
			t.Fatalf("session %s is outside the range: %+v", session.ID, session)
		}
	}

	// A range that holds only the seeded lecture still finds it, and a tight
	// one-day range excludes the rest.
	narrow := api.readScheduleOut(t, "ADMIN", "?from=2026-11-23&to=2026-11-23")
	if len(narrow.Sessions) != 2 {
		t.Fatalf("one-day range: want 2 sessions, got %d: %+v", len(narrow.Sessions), narrow.Sessions)
	}

	// Nothing in July.
	empty := api.readScheduleOut(t, "STUDENT", "?from=2026-07-01&to=2026-07-31")
	if len(empty.Sessions) != 0 {
		t.Fatalf("July range: want no sessions, got %+v", empty.Sessions)
	}
}

// TestScheduleDefaultsToTheCurrentWeek checks the no-parameter case: the week
// that contains today, Monday to Sunday.
func TestScheduleDefaultsToTheCurrentWeek(t *testing.T) {
	api := newAuthAPI(t)
	mathsID := api.subjectIDByCode(t, "MATH101")

	monday, _ := scheduleWeek(time.Now())
	thisWeek := api.scheduledLecture(t, mathsID, map[string]any{
		"title":        "This week",
		"scheduled_at": monday.AddDate(0, 0, 1).Add(10 * time.Hour).Format(time.RFC3339),
	})
	nextMonth := api.scheduledLecture(t, mathsID, map[string]any{
		"title":        "Next month",
		"scheduled_at": monday.AddDate(0, 0, 30).Add(10 * time.Hour).Format(time.RFC3339),
	})

	payload := api.readScheduleOut(t, "STUDENT", "")
	found := false
	for _, session := range payload.Sessions {
		if session.ID == nextMonth {
			t.Fatalf("a lecture outside the current week must not appear by default")
		}
		if session.ID == thisWeek {
			found = true
		}
	}
	if !found {
		t.Fatalf("the default week should include today's week: %+v", payload.Sessions)
	}
}

// TestScheduleRejectsBadDates keeps a typo out of the query: from/to are
// calendar dates or nothing.
func TestScheduleRejectsBadDates(t *testing.T) {
	api := newAuthAPI(t)
	for _, query := range []string{
		"?from=23-11-2026",
		"?from=yesterday",
		"?to=2026-11-31T00:00:00Z",
		"?to=not-a-date",
	} {
		recorder := api.asRole("STUDENT", http.MethodGet, "/api/schedule"+query, nil)
		if recorder.Code != http.StatusBadRequest {
			t.Errorf("%s: want 400, got %d body %s", query, recorder.Code, recorder.Body.String())
		}
	}
}

// TestScheduleNeedsASession: the timetable is open to every signed-in caller,
// and to nobody else.
func TestScheduleNeedsASession(t *testing.T) {
	api := newAuthAPI(t)
	recorder := api.post(http.MethodGet, "/api/schedule", nil, nil)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous schedule: want 401, got %d body %s", recorder.Code, recorder.Body.String())
	}

	// Every role reads it.
	for _, role := range []string{"ADMIN", "LECTURER", "STUDENT"} {
		if recorder := api.asRole(role, http.MethodGet, "/api/schedule", nil); recorder.Code != http.StatusOK {
			t.Errorf("%s: want 200, got %d body %s", role, recorder.Code, recorder.Body.String())
		}
	}
}

// TestTimetableModuleReachesEveryRole: the sidebar entry is gated on the module
// key, so every role has to receive it — from the migration on an existing
// database and from the seed on a fresh one.
func TestTimetableModuleReachesEveryRole(t *testing.T) {
	api := newAuthAPI(t)
	for _, role := range []string{"ADMIN", "LECTURER", "STUDENT"} {
		_, payload := api.signIn(role)
		if !contains(payload.Modules, "timetable") {
			t.Errorf("%s should reach the timetable module, got %v", role, payload.Modules)
		}
	}
}
