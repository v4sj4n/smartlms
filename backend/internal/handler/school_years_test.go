package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"smartlms/backend/internal/db"
	"smartlms/backend/internal/util"
)

// schoolYearAPI builds the school-year and subject endpoints over a throwaway
// database, so the tests run the real SQL (the active-year index included).
func schoolYearAPI(t *testing.T) (*sql.DB, *http.ServeMux) {
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
	registerSchoolYears(mux, database)
	registerSubjects(mux, database)
	return database, mux
}

func call(t *testing.T, mux *http.ServeMux, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(payload)
	}
	request := httptest.NewRequest(method, path, reader)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, request)
	return recorder
}

func decodeSchoolYears(t *testing.T, recorder *httptest.ResponseRecorder) schoolYearListOut {
	t.Helper()
	if recorder.Code != http.StatusOK {
		t.Fatalf("list school years: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var out schoolYearListOut
	if err := json.NewDecoder(recorder.Body).Decode(&out); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	return out
}

func createYear(t *testing.T, mux *http.ServeMux, body map[string]any) schoolYearOut {
	t.Helper()
	recorder := call(t, mux, http.MethodPost, "/api/school-years", body)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create school year: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var out schoolYearOut
	if err := json.NewDecoder(recorder.Body).Decode(&out); err != nil {
		t.Fatalf("decode created year: %v", err)
	}
	return out
}

// The first year created becomes the current one, and activating another year
// takes the flag away from it: the database allows exactly one active row.
func TestSchoolYearActivationIsExclusive(t *testing.T) {
	_, mux := schoolYearAPI(t)

	first := createYear(t, mux, map[string]any{"name": "2025/2026"})
	if !first.IsActive {
		t.Fatalf("first year should become the current one, got %+v", first)
	}

	second := createYear(t, mux, map[string]any{"name": "2026-2027", "is_active": true})
	if second.Name != "2026/2027" {
		t.Fatalf("year name should be normalised to 2026/2027, got %q", second.Name)
	}

	list := decodeSchoolYears(t, call(t, mux, http.MethodGet, "/api/school-years", nil))
	if list.Active != "2026/2027" {
		t.Fatalf("active year = %q, want 2026/2027", list.Active)
	}
	for _, year := range list.Items {
		if year.Name == "2025/2026" && year.IsActive {
			t.Fatal("creating a current year must deactivate the previous one")
		}
	}

	// Activating the older year moves the flag back, and only there.
	if recorder := call(t, mux, http.MethodPost, "/api/school-years/"+first.ID+"/activate", nil); recorder.Code != http.StatusNoContent {
		t.Fatalf("activate: status %d body %s", recorder.Code, recorder.Body.String())
	}
	list = decodeSchoolYears(t, call(t, mux, http.MethodGet, "/api/school-years", nil))
	if list.Active != "2025/2026" {
		t.Fatalf("active year = %q, want 2025/2026", list.Active)
	}
	active := 0
	for _, year := range list.Items {
		if year.IsActive {
			active++
		}
	}
	if active != 1 {
		t.Fatalf("%d active years, want exactly 1", active)
	}
}

// Renaming a year follows through to the subjects and grade scales that carry
// its name, so no record is left pointing at a year that no longer exists.
func TestRenamingSchoolYearFollowsSubjectsAndScales(t *testing.T) {
	database, mux := schoolYearAPI(t)
	year := createYear(t, mux, map[string]any{"name": "2026/2027", "starts_on": "2026-09-01"})

	recorder := call(t, mux, http.MethodPost, "/api/subjects", map[string]any{
		"name":        "Calculus I",
		"school_year": "2026/2027",
	})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create subject: status %d body %s", recorder.Code, recorder.Body.String())
	}

	now := util.Now()
	if _, err := database.Exec(`INSERT INTO grade_scales (id, name, school_year, is_default, pass_grade, bands, created_at, updated_at)
		VALUES (?, 'Standard', '2026/2027', 1, 4, '[]', ?, ?)`, util.NewID(), now, now); err != nil {
		t.Fatalf("insert grade scale: %v", err)
	}

	recorder = call(t, mux, http.MethodPatch, "/api/school-years/"+year.ID, map[string]any{"name": "2027/2028"})
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("rename: status %d body %s", recorder.Code, recorder.Body.String())
	}

	var subjectYear, scaleYear string
	if err := database.QueryRow(`SELECT COALESCE(school_year, '') FROM subjects WHERE name = 'Calculus I'`).Scan(&subjectYear); err != nil {
		t.Fatalf("read subject: %v", err)
	}
	if subjectYear != "2027/2028" {
		t.Fatalf("subject year = %q, want 2027/2028", subjectYear)
	}
	if err := database.QueryRow(`SELECT COALESCE(school_year, '') FROM grade_scales WHERE name = 'Standard'`).Scan(&scaleYear); err != nil {
		t.Fatalf("read grade scale: %v", err)
	}
	if scaleYear != "2027/2028" {
		t.Fatalf("grade scale year = %q, want 2027/2028", scaleYear)
	}
}

// A year cannot be removed while it is current or while subjects still sit in
// it: deleting either would strand academic records.
func TestDeletingSchoolYearIsGuarded(t *testing.T) {
	_, mux := schoolYearAPI(t)
	active := createYear(t, mux, map[string]any{"name": "2026/2027"})
	archived := createYear(t, mux, map[string]any{"name": "2025/2026"})

	if recorder := call(t, mux, http.MethodDelete, "/api/school-years/"+active.ID, nil); recorder.Code != http.StatusConflict {
		t.Fatalf("deleting the current year: status %d, want 409", recorder.Code)
	}

	if recorder := call(t, mux, http.MethodPost, "/api/subjects", map[string]any{
		"name":        "Old seminar",
		"school_year": "2025/2026",
	}); recorder.Code != http.StatusCreated {
		t.Fatalf("create subject: status %d body %s", recorder.Code, recorder.Body.String())
	}
	if recorder := call(t, mux, http.MethodDelete, "/api/school-years/"+archived.ID, nil); recorder.Code != http.StatusConflict {
		t.Fatalf("deleting a year with subjects: status %d, want 409", recorder.Code)
	}

	empty := createYear(t, mux, map[string]any{"name": "2024/2025"})
	if recorder := call(t, mux, http.MethodDelete, "/api/school-years/"+empty.ID, nil); recorder.Code != http.StatusNoContent {
		t.Fatalf("deleting an empty archived year: status %d body %s", recorder.Code, recorder.Body.String())
	}
}

// A subject created without a year lands in the current one; a year the
// catalog does not know is refused instead of being written verbatim.
func TestSubjectTakesActiveYearOrDefault(t *testing.T) {
	_, mux := schoolYearAPI(t)
	createYear(t, mux, map[string]any{"name": "2025/2026"})
	createYear(t, mux, map[string]any{"name": "2026/2027", "is_active": true})

	if recorder := call(t, mux, http.MethodPost, "/api/subjects", map[string]any{
		"name": "Physics I",
	}); recorder.Code != http.StatusCreated {
		t.Fatalf("create subject: status %d body %s", recorder.Code, recorder.Body.String())
	}

	recorder := call(t, mux, http.MethodGet, "/api/subjects?school_year=2026/2027", nil)
	if recorder.Code != http.StatusOK {
		t.Fatalf("list subjects: status %d body %s", recorder.Code, recorder.Body.String())
	}
	var page struct {
		Items []subjectOut `json:"items"`
		Total int          `json:"total"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&page); err != nil {
		t.Fatalf("decode subjects: %v", err)
	}
	if page.Total != 1 || len(page.Items) != 1 {
		t.Fatalf("filtered subjects = %d (total %d), want 1 in the current year", len(page.Items), page.Total)
	}
	if page.Items[0].SchoolYear != "2026/2027" {
		t.Fatalf("subject year = %q, want the active year 2026/2027", page.Items[0].SchoolYear)
	}

	recorder = call(t, mux, http.MethodPost, "/api/subjects", map[string]any{
		"name":        "Ghost subject",
		"school_year": "1999/2000",
	})
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("unknown year: status %d, want 400", recorder.Code)
	}
}

// Typos and duplicates are refused rather than stored as another spelling of
// the same year.
func TestSchoolYearNameValidation(t *testing.T) {
	_, mux := schoolYearAPI(t)
	createYear(t, mux, map[string]any{"name": "2026/2027"})

	if recorder := call(t, mux, http.MethodPost, "/api/school-years", map[string]any{"name": "2026-2027"}); recorder.Code != http.StatusConflict {
		t.Fatalf("duplicate year: status %d, want 409", recorder.Code)
	}
	if recorder := call(t, mux, http.MethodPost, "/api/school-years", map[string]any{"name": "next year"}); recorder.Code != http.StatusBadRequest {
		t.Fatalf("malformed year: status %d, want 400", recorder.Code)
	}
	if recorder := call(t, mux, http.MethodPost, "/api/school-years", map[string]any{
		"name": "2027/2028", "starts_on": "2027-09-01", "ends_on": "2027-06-30",
	}); recorder.Code != http.StatusBadRequest {
		t.Fatalf("ends_on before starts_on: status %d, want 400", recorder.Code)
	}
}
