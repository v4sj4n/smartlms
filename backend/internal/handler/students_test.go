package handler

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestStudentListFiltersByProgrammeYearAndGPA(t *testing.T) {
	api := newAuthAPI(t)

	list := func(query string) []studentRowOut {
		t.Helper()
		recorder := api.asRole("ADMIN", http.MethodGet, "/api/students?search=student%40optimolms&"+query, nil)
		if recorder.Code != http.StatusOK {
			t.Fatalf("GET /api/students?%s = %d: %s", query, recorder.Code, recorder.Body)
		}
		var page struct {
			Items []studentRowOut `json:"items"`
		}
		if err := json.Unmarshal(recorder.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
		return page.Items
	}
	has := func(rows []studentRowOut, email string) bool {
		for _, row := range rows {
			if row.Email == email {
				return true
			}
		}
		return false
	}

	all := list("")
	if !has(all, "student@optimolms.dev") {
		t.Fatalf("demo student missing from list: %+v", all)
	}
	var demo studentRowOut
	for _, row := range all {
		if row.Email == "student@optimolms.dev" {
			demo = row
		}
	}
	if demo.ProgrammeCode != "BSc-CS" || demo.YearOfStudy != 1 {
		t.Fatalf("demo student admission = %+v, want BSc-CS year 1", demo)
	}

	if !has(list("programme_id="+demo.ProgrammeID+"&year_of_study=1"), demo.Email) {
		t.Fatal("programme + year filter dropped the demo student")
	}
	if has(list("year_of_study=3"), demo.Email) {
		t.Fatal("year 3 filter kept a first-year student")
	}
	if has(list("status=UNPLACED"), demo.Email) {
		t.Fatal("unplaced filter kept an admitted student")
	}
	if has(list("gpa_min=10.5"), demo.Email) {
		t.Fatal("impossible GPA floor kept the demo student")
	}

	if code := api.asRole("STUDENT", http.MethodGet, "/api/students", nil).Code; code != http.StatusForbidden {
		t.Fatalf("student reading the list = %d, want 403", code)
	}
}
