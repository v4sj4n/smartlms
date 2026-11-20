package handler

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func uploadFile(t *testing.T, mux *http.ServeMux, lectureID, name string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	part, err := form.CreateFormFile("file", name)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write(data)
	_ = form.Close()
	request := httptest.NewRequest(http.MethodPut, "/api/lectures/"+lectureID+"/file", &body)
	request.Header.Set("Content-Type", form.FormDataContentType())
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, request)
	return recorder
}

// A lecture takes one PDF, HTML or ZIP file; the subject lists it, the file
// downloads with safe headers, and a re-upload replaces it.
func TestLectureFileLifecycle(t *testing.T) {
	database, mux := weekAPI(t)
	registerLectureFiles(mux, database)
	subjectID := createCourse(t, mux, "Physics")

	recorder := call(t, mux, http.MethodPost, "/api/subjects/"+subjectID+"/lectures", map[string]any{"title": "Optics"})
	if recorder.Code != http.StatusCreated {
		t.Fatalf("create lecture: %d %s", recorder.Code, recorder.Body.String())
	}
	var lecture lectureOut
	_ = json.NewDecoder(recorder.Body).Decode(&lecture)

	for _, rejected := range []struct{ name, body string }{
		{"notes.docx", "PK\x03\x04..."},
		{"fake.pdf", "MZ\x90\x00 not a pdf"},
		{"fake.zip", "%PDF-1.7"},
		{"bin.html", "<p>\x00\x01</p>"},
		{"empty.pdf", ""},
	} {
		if got := uploadFile(t, mux, lecture.ID, rejected.name, []byte(rejected.body)); got.Code < 400 {
			t.Errorf("%s: accepted with %d", rejected.name, got.Code)
		}
	}

	if got := uploadFile(t, mux, lecture.ID, "slides.pdf", []byte("%PDF-1.7 slides")); got.Code != http.StatusOK {
		t.Fatalf("upload pdf: %d %s", got.Code, got.Body.String())
	}
	if got := uploadFile(t, mux, lecture.ID, "page.HTML", []byte("<h1>Optics</h1><script>alert(1)</script>")); got.Code != http.StatusOK {
		t.Fatalf("replace with html: %d %s", got.Code, got.Body.String())
	}

	recorder = call(t, mux, http.MethodGet, "/api/subjects/"+subjectID, nil)
	var detail struct {
		Lectures []lectureOut `json:"lectures"`
	}
	_ = json.NewDecoder(recorder.Body).Decode(&detail)
	if len(detail.Lectures) != 1 || detail.Lectures[0].File == nil || detail.Lectures[0].File.Type != "html" || detail.Lectures[0].File.Name != "page.HTML" {
		t.Fatalf("subject should list the replaced html file, got %+v", detail.Lectures)
	}

	recorder = call(t, mux, http.MethodGet, "/api/lectures/"+lecture.ID+"/file", nil)
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), "<h1>Optics</h1>") {
		t.Fatalf("download: %d %s", recorder.Code, recorder.Body.String())
	}
	if csp := recorder.Header().Get("Content-Security-Policy"); !strings.HasPrefix(csp, "sandbox") {
		t.Errorf("html must be sandboxed, CSP %q", csp)
	}
	if recorder.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Error("missing nosniff")
	}

	if got := uploadFile(t, mux, lecture.ID, "bundle.zip", []byte("PK\x03\x04rest")); got.Code != http.StatusOK {
		t.Fatalf("upload zip: %d", got.Code)
	}
	recorder = call(t, mux, http.MethodGet, "/api/lectures/"+lecture.ID+"/file", nil)
	if !strings.HasPrefix(recorder.Header().Get("Content-Disposition"), "attachment") {
		t.Errorf("zip should download, got %q", recorder.Header().Get("Content-Disposition"))
	}

	if got := call(t, mux, http.MethodDelete, "/api/lectures/"+lecture.ID+"/file", nil); got.Code != http.StatusNoContent {
		t.Fatalf("delete file: %d", got.Code)
	}
	if got := call(t, mux, http.MethodGet, "/api/lectures/"+lecture.ID+"/file", nil); got.Code != http.StatusNotFound {
		t.Fatalf("deleted file still served: %d", got.Code)
	}

	// Deleting the lecture takes its file with it.
	_ = uploadFile(t, mux, lecture.ID, "slides.pdf", []byte("%PDF-1.7"))
	call(t, mux, http.MethodDelete, "/api/lectures/"+lecture.ID, nil)
	var left int
	_ = database.QueryRow(`SELECT COUNT(*) FROM lecture_files`).Scan(&left)
	if left != 0 {
		t.Fatalf("lecture delete left %d files behind", left)
	}
}
