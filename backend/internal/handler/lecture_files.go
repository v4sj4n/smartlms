package handler

import (
	"bytes"
	"database/sql"
	"errors"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"optimolms/backend/internal/util"
)

// maxLectureFileBytes caps one lecture file. ZIP bundles of slides and
// examples are the large case; anything bigger belongs on a file host.
const maxLectureFileBytes = 50 << 20

// lectureFileKinds is the whole allow-list: extension -> stored content type.
var lectureFileKinds = map[string]string{
	".pdf":  "application/pdf",
	".html": "text/html; charset=utf-8",
	".htm":  "text/html; charset=utf-8",
	".zip":  "application/zip",
}

// lectureFileOut is the file summary embedded in a lecture.
type lectureFileOut struct {
	Name       string `json:"name"`
	Type       string `json:"type"` // pdf | html | zip
	Size       int64  `json:"size"`
	UploadedAt string `json:"uploaded_at"`
}

func registerLectureFiles(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/lectures/{id}/file", downloadLectureFile(db))
	mux.HandleFunc("PUT /api/lectures/{id}/file", uploadLectureFile(db))
	mux.HandleFunc("DELETE /api/lectures/{id}/file", deleteLectureFile(db))
}

// lectureFileType maps a stored content type to the short kind the UI shows.
func lectureFileType(contentType string) string {
	switch {
	case strings.HasPrefix(contentType, "application/pdf"):
		return "pdf"
	case strings.HasPrefix(contentType, "text/html"):
		return "html"
	default:
		return "zip"
	}
}

// sniffMatches checks the bytes agree with the extension, so a renamed
// executable cannot pass as a PDF.
func sniffMatches(ext string, data []byte) bool {
	switch ext {
	case ".pdf":
		return bytes.HasPrefix(data, []byte("%PDF-"))
	case ".zip":
		return bytes.HasPrefix(data, []byte("PK\x03\x04")) || bytes.HasPrefix(data, []byte("PK\x05\x06"))
	case ".html", ".htm":
		head := data
		if len(head) > 4096 {
			head = head[:4096]
		}
		return !bytes.Contains(head, []byte{0})
	}
	return false
}

func uploadLectureFile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !rowExists(r.Context(), db, "lectures", id) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}

		// Leave headroom for the multipart envelope around the file itself.
		r.Body = http.MaxBytesReader(w, r.Body, maxLectureFileBytes+1<<20)
		file, header, err := r.FormFile("file")
		if err != nil {
			var tooBig *http.MaxBytesError
			if errors.As(err, &tooBig) {
				writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "the file is larger than 50 MB"})
				return
			}
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "attach the file in a 'file' form field"})
			return
		}
		defer file.Close()

		name := filepath.Base(strings.ReplaceAll(header.Filename, "\\", "/"))
		ext := strings.ToLower(filepath.Ext(name))
		contentType, ok := lectureFileKinds[ext]
		if !ok {
			writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{"error": "lectures accept .pdf, .html or .zip files"})
			return
		}

		data, err := io.ReadAll(io.LimitReader(file, maxLectureFileBytes+1))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "the file could not be read"})
			return
		}
		if len(data) > maxLectureFileBytes {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "the file is larger than 50 MB"})
			return
		}
		if len(data) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "the file is empty"})
			return
		}
		if !sniffMatches(ext, data) {
			writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{"error": "the file's contents do not match its " + ext + " extension"})
			return
		}

		now := util.Now()
		_, err = db.ExecContext(r.Context(), `
			INSERT INTO lecture_files (lecture_id, file_name, content_type, size, data, uploaded_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT (lecture_id) DO UPDATE SET
			  file_name = excluded.file_name, content_type = excluded.content_type,
			  size = excluded.size, data = excluded.data, uploaded_at = excluded.uploaded_at`,
			id, name, contentType, len(data), data, now)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, lectureFileOut{
			Name: name, Type: lectureFileType(contentType), Size: int64(len(data)), UploadedAt: now,
		})
	}
}

func downloadLectureFile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var (
			name, contentType, uploadedAt string
			data                          []byte
		)
		err := db.QueryRowContext(r.Context(),
			`SELECT file_name, content_type, data, uploaded_at FROM lecture_files WHERE lecture_id = ?`,
			r.PathValue("id")).Scan(&name, &contentType, &data, &uploadedAt)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "this lecture has no file"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// PDFs and HTML open in the browser; ZIPs, or ?download=1, save to disk.
		disposition := "inline"
		if lectureFileType(contentType) == "zip" || r.URL.Query().Get("download") == "1" {
			disposition = "attachment"
		}
		h := w.Header()
		h.Set("Content-Type", contentType)
		h.Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": name}))
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Cache-Control", "private, no-cache")
		if lectureFileType(contentType) == "html" {
			// Uploaded HTML must not run with the app's origin and cookies: the
			// sandbox gives it an opaque origin and blocks scripts and forms.
			h.Set("Content-Security-Policy", "sandbox; default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https:; font-src data: https:")
		}
		modified, _ := time.Parse(time.RFC3339, uploadedAt)
		http.ServeContent(w, r, name, modified, bytes.NewReader(data))
	}
}

func deleteLectureFile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `DELETE FROM lecture_files WHERE lecture_id = ?`, r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "this lecture has no file"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
