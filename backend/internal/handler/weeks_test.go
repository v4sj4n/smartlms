package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"path/filepath"
	"testing"

	"optimolms/backend/internal/db"
)

// weekAPI builds the week and subject endpoints over a throwaway database, so
// the tests run the real SQL and the real week constraint.
func weekAPI(t *testing.T) (*sql.DB, *http.ServeMux) {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(context.Background(), database); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	mux := http.NewServeMux()
	registerSubjects(mux, database)
	registerWeeks(mux, database)
	return database, mux
}

// createCourse makes an empty subject and returns its id.
func createCourse(t *testing.T, mux *http.ServeMux, name string) string {
	t.Helper()
	recorder := call(t, mux, http.MethodPost, "/api/subjects", map[string]any{"name": name})
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

func addWeek(t *testing.T, mux *http.ServeMux, subjectID string, body map[string]any) weekOut {
	t.Helper()
	recorder := call(t, mux, http.MethodPost, "/api/subjects/"+subjectID+"/weeks", body)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create week: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var week weekOut
	if err := json.NewDecoder(recorder.Body).Decode(&week); err != nil {
		t.Fatalf("decode week: %v", err)
	}
	return week
}

func subjectWeeks(t *testing.T, mux *http.ServeMux, subjectID string) weeksOut {
	t.Helper()
	recorder := call(t, mux, http.MethodGet, "/api/subjects/"+subjectID+"/weeks", nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("list weeks: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var out weeksOut
	if err := json.NewDecoder(recorder.Body).Decode(&out); err != nil {
		t.Fatalf("decode weeks: %v", err)
	}
	return out
}

// A week gets a number, a season and a date range: one bound is enough, the
// week is seven days long.
func TestWeekTakesASevenDayRange(t *testing.T) {
	_, mux := weekAPI(t)
	subjectID := createCourse(t, mux, "Mathematics I")

	week := addWeek(t, mux, subjectID, map[string]any{
		"week_number": 1,
		"season":      "FALL",
		"starts_on":   "2026-11-23",
		"title":       "Limits",
	})
	if week.Season != "FALL" || week.WeekNumber != 1 || week.Title != "Limits" {
		t.Fatalf("unexpected week: %+v", week)
	}
	if week.StartsOn != "2026-11-23" || week.EndsOn != "2026-11-29" {
		t.Fatalf("week range: want 2026-11-23..2026-11-29, got %s..%s", week.StartsOn, week.EndsOn)
	}

	// The next number is one past the last week of the season.
	next := addWeek(t, mux, subjectID, map[string]any{"season": "FALL"})
	if next.WeekNumber != 2 {
		t.Fatalf("next week number: want 2, got %d", next.WeekNumber)
	}
}

// A week number is unique inside a season: the same number in the other season
// is a different week.
func TestWeekNumbersAreUniquePerSeason(t *testing.T) {
	_, mux := weekAPI(t)
	subjectID := createCourse(t, mux, "Mathematics I")

	addWeek(t, mux, subjectID, map[string]any{"week_number": 1, "season": "FALL"})

	recorder := call(t, mux, http.MethodPost, "/api/subjects/"+subjectID+"/weeks", map[string]any{
		"week_number": 1, "season": "FALL",
	})
	if recorder.Code != http.StatusConflict {
		t.Fatalf("duplicate week: want 409, got %d body %s", recorder.Code, recorder.Body.String())
	}

	addWeek(t, mux, subjectID, map[string]any{"week_number": 1, "season": "SUMMER"})

	weeks := subjectWeeks(t, mux, subjectID)
	if len(weeks.Weeks) != 2 {
		t.Fatalf("weeks: want 2, got %d", len(weeks.Weeks))
	}
	// Fall reads before summer.
	if weeks.Weeks[0].Season != "FALL" || weeks.Weeks[1].Season != "SUMMER" {
		t.Fatalf("weeks out of order: %+v", weeks.Weeks)
	}
}

// Content filed into a week shows up in it; content without a week stays in the
// unscheduled list instead of vanishing.
func TestContentIsListedInsideItsWeek(t *testing.T) {
	_, mux := weekAPI(t)
	subjectID := createCourse(t, mux, "Mathematics I")
	week := addWeek(t, mux, subjectID, map[string]any{"week_number": 1, "season": "FALL"})

	recorder := call(t, mux, http.MethodPost, "/api/subjects/"+subjectID+"/lectures", map[string]any{
		"title": "Introduction to limits", "week_id": week.ID,
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create lecture: status %d body %s", recorder.Code, recorder.Body.String())
	}
	recorder = call(t, mux, http.MethodPost, "/api/subjects/"+subjectID+"/assignments", map[string]any{
		"title": "Derivative exercises", "due_at": "2026-11-28T23:59:00Z", "week_id": week.ID,
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create assignment: status %d body %s", recorder.Code, recorder.Body.String())
	}
	// A quiz with no week: it belongs to the course, not to a particular week.
	recorder = call(t, mux, http.MethodPost, "/api/subjects/"+subjectID+"/quizzes", map[string]any{
		"title": "Limits basics",
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create quiz: status %d body %s", recorder.Code, recorder.Body.String())
	}

	weeks := subjectWeeks(t, mux, subjectID)
	if len(weeks.Weeks) != 1 {
		t.Fatalf("weeks: want 1, got %d", len(weeks.Weeks))
	}
	items := weeks.Weeks[0].Items
	if len(items) != 2 {
		t.Fatalf("week items: want the lecture and the assignment, got %+v", items)
	}
	if items[0].Kind != "lecture" || items[0].Title != "Introduction to limits" {
		t.Fatalf("first item: %+v", items[0])
	}
	if items[1].Kind != "assignment" || items[1].DueAt == "" {
		t.Fatalf("second item: %+v", items[1])
	}
	if len(weeks.Unscheduled) != 1 || weeks.Unscheduled[0].Kind != "quiz" {
		t.Fatalf("unscheduled: %+v", weeks.Unscheduled)
	}
}

// A week belongs to one subject: content cannot be filed into another
// subject's week.
func TestAnotherSubjectsWeekIsRefused(t *testing.T) {
	_, mux := weekAPI(t)
	maths := createCourse(t, mux, "Mathematics I")
	physics := createCourse(t, mux, "Physics I")
	physicsWeek := addWeek(t, mux, physics, map[string]any{"week_number": 1, "season": "FALL"})

	recorder := call(t, mux, http.MethodPost, "/api/subjects/"+maths+"/lectures", map[string]any{
		"title": "Introduction to limits", "week_id": physicsWeek.ID,
	})
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("foreign week: want 400, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

// Removing a week keeps the content: it becomes unscheduled so it can be filed
// again.
func TestDeletingAWeekKeepsItsContent(t *testing.T) {
	_, mux := weekAPI(t)
	subjectID := createCourse(t, mux, "Mathematics I")
	week := addWeek(t, mux, subjectID, map[string]any{"week_number": 1, "season": "FALL"})

	recorder := call(t, mux, http.MethodPost, "/api/subjects/"+subjectID+"/lectures", map[string]any{
		"title": "Introduction to limits", "week_id": week.ID,
	})
	var lecture lectureOut
	if err := json.NewDecoder(recorder.Body).Decode(&lecture); err != nil {
		t.Fatalf("decode lecture: %v", err)
	}
	if lecture.WeekID != week.ID {
		t.Fatalf("lecture week: want %s, got %q", week.ID, lecture.WeekID)
	}

	recorder = call(t, mux, http.MethodDelete, "/api/weeks/"+week.ID, nil)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("delete week: status %d body %s", recorder.Code, recorder.Body.String())
	}

	weeks := subjectWeeks(t, mux, subjectID)
	if len(weeks.Weeks) != 0 {
		t.Fatalf("weeks after delete: want none, got %+v", weeks.Weeks)
	}
	if len(weeks.Unscheduled) != 1 || weeks.Unscheduled[0].Title != "Introduction to limits" {
		t.Fatalf("content should be unscheduled, got %+v", weeks.Unscheduled)
	}
}

// Moving content from one week to another is a patch, and clearing the week
// unschedules it again.
func TestMovingContentBetweenWeeks(t *testing.T) {
	_, mux := weekAPI(t)
	subjectID := createCourse(t, mux, "Mathematics I")
	first := addWeek(t, mux, subjectID, map[string]any{"week_number": 1, "season": "FALL"})
	second := addWeek(t, mux, subjectID, map[string]any{"week_number": 2, "season": "FALL"})

	recorder := call(t, mux, http.MethodPost, "/api/subjects/"+subjectID+"/flashcard-sets", map[string]any{
		"title":   "Derivatives",
		"week_id": first.ID,
		"cards":   []map[string]string{{"front": "What is the derivative of x^2?", "back": "2x"}},
	})
	var card flashcardSetOut
	if err := json.NewDecoder(recorder.Body).Decode(&card); err != nil {
		t.Fatalf("decode flashcard set: %v", err)
	}

	recorder = call(t, mux, http.MethodPatch, "/api/flashcard-sets/"+card.ID, map[string]any{
		"week_id": second.ID,
	})
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("move flashcard: status %d body %s", recorder.Code, recorder.Body.String())
	}

	weeks := subjectWeeks(t, mux, subjectID)
	for _, week := range weeks.Weeks {
		if week.ID == second.ID && len(week.Items) != 1 {
			t.Fatalf("second week should hold the set, got %+v", week.Items)
		}
		if week.ID == first.ID && len(week.Items) != 0 {
			t.Fatalf("first week should be empty, got %+v", week.Items)
		}
	}

	recorder = call(t, mux, http.MethodPatch, "/api/flashcard-sets/"+card.ID, map[string]any{"week_id": ""})
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("clear week: status %d body %s", recorder.Code, recorder.Body.String())
	}
	weeks = subjectWeeks(t, mux, subjectID)
	if len(weeks.Unscheduled) != 1 {
		t.Fatalf("unscheduled after clearing the week: %+v", weeks.Unscheduled)
	}
}

// A set is saved with its cards in order; patching cards replaces the deck,
// and a half-filled card is refused.
func TestFlashcardSetCards(t *testing.T) {
	_, mux := weekAPI(t)
	subjectID := createCourse(t, mux, "Mathematics I")

	recorder := call(t, mux, http.MethodPost, "/api/subjects/"+subjectID+"/flashcard-sets", map[string]any{
		"title": "Limits",
		"cards": []map[string]string{{"front": "lim sin(x)/x", "back": "1"}, {"front": "lim 1/x, x→∞", "back": "0"}},
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create set: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var set flashcardSetOut
	if err := json.NewDecoder(recorder.Body).Decode(&set); err != nil {
		t.Fatalf("decode set: %v", err)
	}
	if len(set.Cards) != 2 || set.Cards[1].Back != "0" {
		t.Fatalf("cards not saved in order: %+v", set.Cards)
	}

	recorder = call(t, mux, http.MethodPatch, "/api/flashcard-sets/"+set.ID, map[string]any{
		"cards": []map[string]string{{"front": "Only card", "back": "Back"}},
	})
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("replace cards: status %d body %s", recorder.Code, recorder.Body.String())
	}

	recorder = call(t, mux, http.MethodPatch, "/api/flashcard-sets/"+set.ID, map[string]any{
		"cards": []map[string]string{{"front": "No back", "back": " "}},
	})
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("half-filled card accepted: status %d", recorder.Code)
	}

	recorder = call(t, mux, http.MethodGet, "/api/subjects/"+subjectID, nil)
	var detail subjectDetailOut
	if err := json.NewDecoder(recorder.Body).Decode(&detail); err != nil {
		t.Fatalf("decode subject: %v", err)
	}
	if len(detail.FlashcardSets) != 1 || len(detail.FlashcardSets[0].Cards) != 1 ||
		detail.FlashcardSets[0].Cards[0].Front != "Only card" {
		t.Fatalf("subject detail sets: %+v", detail.FlashcardSets)
	}
}
