package handler

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"optimolms/backend/internal/util"
)

/*
Assignment submission files.

A student hands the work itself in, not just a share link: the bytes go into the
database next to the submission (migration 000027, the pattern of
000023_lecture_files), and every submission payload carries the summary — name,
kind, size — while the BLOB stays behind the download route.

The limits are not baked in: the extension allow-list and the size cap come from
general_settings (see general_settings.go), so an administrator can tighten an
assignment season without a deploy. Whatever the allow-list says, HTML-like and
executable extensions never pass: uploaded HTML served from the app's own origin
would run with the app's cookies, which is exactly the trap lecture_files.go
sandboxes its downloads against.
*/

// Multiplication headroom: the multipart envelope around the file is a few
// hundred bytes, so the reader is allowed one extra MiB on top of the cap.
const submissionEnvelopeSlack = 1 << 20

// submissionFileContentTypes is what a download serves each kind as. The kind is
// the extension the student used, normalized, and the content type is fixed here
// rather than taken from the client: the browser's guess is not evidence.
var submissionFileContentTypes = map[string]string{
	"pdf":  "application/pdf",
	"docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"zip":  "application/zip",
	"png":  "image/png",
	"jpg":  "image/jpeg",
	"jpeg": "image/jpeg",
	"gif":  "image/gif",
	"webp": "image/webp",
	"txt":  "text/plain; charset=utf-8",
	"md":   "text/plain; charset=utf-8",
	"csv":  "text/csv; charset=utf-8",
	"rtf":  "application/rtf",
	"odt":  "application/vnd.oasis.opendocument.text",
	"ods":  "application/vnd.oasis.opendocument.spreadsheet",
	"odp":  "application/vnd.oasis.opendocument.presentation",
}

// submissionBlockedTypes never pass, even if an administrator adds them to the
// allow-list. Two families: documents a browser would execute in the app's
// origin (html, svg, xml-ish markup) and executables.
var submissionBlockedTypes = map[string]bool{
	"html": true, "htm": true, "xhtml": true, "shtml": true, "svg": true,
	"js": true, "mjs": true,
	"exe": true, "dll": true, "bat": true, "cmd": true, "com": true, "scr": true,
	"msi": true, "ps1": true, "sh": true, "bash": true, "zsh": true,
	"jar": true, "php": true, "asp": true, "aspx": true, "cgi": true,
	"vbs": true, "wsf": true,
}

// submissionFileKinds is the zip family: the same signature, different promise.
var submissionZipFamily = map[string]bool{
	"zip": true, "docx": true, "pptx": true, "xlsx": true,
	"odt": true, "ods": true, "odp": true, "epub": true,
}

// submissionTarget is the assignment side of an upload or a delete: what the
// student may hand in, and what the clock says about it.
type submissionTarget struct {
	subjectID      string
	dueAt          string
	allowLate      bool
	submissionType string
	published      bool
}

func registerSubmissionFiles(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("PUT /api/assignments/{assignmentID}/submission/file", uploadSubmissionFile(db))
	mux.HandleFunc("GET /api/submissions/{submissionID}/file", downloadSubmissionFile(db))
	mux.HandleFunc("DELETE /api/assignments/{assignmentID}/submission/file", deleteSubmissionFile(db))
}

func submissionContentType(ext string) string {
	if contentType, ok := submissionFileContentTypes[ext]; ok {
		return contentType
	}
	if contentType := mime.TypeByExtension("." + ext); contentType != "" {
		return contentType
	}
	return "application/octet-stream"
}

// submissionFileKind is the short badge kind stored with the file: the
// extension, with jpeg folded into jpg so the UI shows one image kind.
func submissionFileKind(ext string) string {
	if ext == "jpeg" {
		return "jpg"
	}
	return ext
}

// submissionSniffMatches checks the bytes agree with the extension for every kind
// that carries a signature, so a renamed executable cannot pass as a PDF or a
// PNG. Plain-text kinds (.txt, .md, .csv) must have no NUL byte in the head.
// Any other extension an administrator added has no known signature and is
// accepted on the allow-list alone.
func submissionSniffMatches(ext string, data []byte) bool {
	head := data
	if len(head) > 4096 {
		head = head[:4096]
	}
	switch {
	case ext == "pdf":
		return bytes.HasPrefix(data, []byte("%PDF-"))
	case submissionZipFamily[ext]:
		return bytes.HasPrefix(data, []byte("PK\x03\x04")) ||
			bytes.HasPrefix(data, []byte("PK\x05\x06")) ||
			bytes.HasPrefix(data, []byte("PK\x07\x08"))
	case ext == "png":
		return bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n"))
	case ext == "jpg" || ext == "jpeg":
		return bytes.HasPrefix(data, []byte{0xFF, 0xD8, 0xFF})
	case ext == "gif":
		return bytes.HasPrefix(data, []byte("GIF87a")) || bytes.HasPrefix(data, []byte("GIF89a"))
	case ext == "webp":
		return len(data) > 12 && bytes.HasPrefix(data, []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WEBP"))
	case ext == "txt" || ext == "md" || ext == "csv":
		return !bytes.Contains(head, []byte{0})
	}
	return true
}

// sanitizeSubmissionFileName keeps the name the student picked, without a path
// and without control characters, so it is safe on disk and in a header.
func sanitizeSubmissionFileName(raw string) string {
	name := filepath.Base(strings.ReplaceAll(raw, "\\", "/"))
	name = strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, name)
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." {
		return ""
	}
	if len(name) > 200 {
		// Keep the tail: the extension is what the download is served as.
		name = name[len(name)-200:]
	}
	return name
}

// enrolledInSubject answers whether the student's enrollments cover the subject.
func enrolledInSubject(ctx context.Context, db *sql.DB, studentID, subjectID string) bool {
	var n int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM enrollments WHERE student_id = ? AND subject_id = ?`,
		studentID, subjectID).Scan(&n)
	return err == nil && n > 0
}

// loadSubmissionTarget reads the assignment an upload is aimed at.
func loadSubmissionTarget(ctx context.Context, db *sql.DB, assignmentID string) (submissionTarget, bool, error) {
	var target submissionTarget
	err := db.QueryRowContext(ctx, `
		SELECT a.subject_id, COALESCE(a.due_at, ''), a.allow_late, a.submission_type, a.is_published
		FROM assignments a WHERE a.id = ?`, assignmentID).
		Scan(&target.subjectID, &target.dueAt, &target.allowLate, &target.submissionType, &target.published)
	if errors.Is(err, sql.ErrNoRows) {
		return target, false, nil
	}
	if err != nil {
		return target, false, err
	}
	return target, true, nil
}

// uploadSubmissionFile stores one file for the caller's submission, creating the
// submission when this is the first thing they hand in. A re-upload replaces the
// previous file in one transaction, so a broken upload never leaves a submission
// without the file it had.
func uploadSubmissionFile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		caller := callerFrom(r)
		assignmentID := r.PathValue("assignmentID")

		target, found, err := loadSubmissionTarget(ctx, db, assignmentID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !found {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "assignment not found"})
			return
		}

		// Only a student hands work in, and only in a subject they are enrolled
		// in. An administrator bypasses the role check: they need to be able to
		// try a broken upload without a student account.
		if !caller.isAdmin() {
			if caller.Role != "STUDENT" {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "only a student can hand in an assignment"})
				return
			}
			if !enrolledInSubject(ctx, db, caller.ID, target.subjectID) {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "not enrolled in this subject"})
				return
			}
		}

		// A written-answer assignment does not take a file: the lecturer asked
		// for text, and the submission_type is the contract the UI follows.
		if target.submissionType == "text" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "this assignment takes a written answer, not a file"})
			return
		}
		if !target.published {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "assignment is not published"})
			return
		}

		// The same clock as the text submission: past the deadline a late hand-in
		// is either marked late or refused.
		status := "submitted"
		switch assignmentStatus("", target.dueAt, target.allowLate, nil) {
		case "closed":
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "the deadline has passed"})
			return
		case "overdue":
			status = "late"
		}

		var existingID, existingStatus string
		err = db.QueryRowContext(ctx,
			`SELECT id, status FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?`,
			assignmentID, caller.ID).Scan(&existingID, &existingStatus)
		switch {
		case err == nil && existingStatus == "graded":
			writeJSON(w, http.StatusConflict, map[string]string{"error": "this submission has already been graded"})
			return
		case err == nil:
			// Replacing the file of an existing submission.
		case errors.Is(err, sql.ErrNoRows):
			existingID = ""
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		settings, err := loadGeneralSettings(ctx, db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		limit := int64(settings.SubmissionMaxFileMB) << 20
		tooBig := "the file is larger than " + strconv.Itoa(settings.SubmissionMaxFileMB) + " MB"

		r.Body = http.MaxBytesReader(w, r.Body, limit+submissionEnvelopeSlack)
		file, header, err := r.FormFile("file")
		if err != nil {
			var maxBytes *http.MaxBytesError
			if errors.As(err, &maxBytes) {
				writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": tooBig})
				return
			}
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "attach the file in a 'file' form field"})
			return
		}
		defer file.Close()

		name := sanitizeSubmissionFileName(header.Filename)
		if name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "the file needs a name"})
			return
		}
		ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
		if ext == "" {
			writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{"error": "the file needs an extension, like worksheet.pdf"})
			return
		}
		if submissionBlockedTypes[ext] {
			writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{
				"error": "." + ext + " files are never accepted: upload the document or a zip of it instead",
			})
			return
		}
		if !containsString(settings.SubmissionAllowedFileTypes, ext) {
			writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{
				"error": "uploads do not accept ." + ext + " files; the school allows " + allowedTypesLabel(settings.SubmissionAllowedFileTypes),
			})
			return
		}

		data, err := io.ReadAll(io.LimitReader(file, limit+1))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "the file could not be read"})
			return
		}
		if int64(len(data)) > limit {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": tooBig})
			return
		}
		if len(data) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "the file is empty"})
			return
		}
		if !submissionSniffMatches(ext, data) {
			writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{
				"error": "the file's contents do not match its ." + ext + " extension",
			})
			return
		}

		created := existingID == ""
		now := util.Now()
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer func() { _ = tx.Rollback() }()

		submissionID := existingID
		if created {
			submissionID = util.NewID()
			_, err = tx.ExecContext(ctx, `
				INSERT INTO assignment_submissions
				  (id, assignment_id, student_id, content, status, submitted_at, updated_at)
				VALUES (?, ?, ?, '', ?, ?, ?)`,
				submissionID, assignmentID, caller.ID, status, now, now)
		} else {
			_, err = tx.ExecContext(ctx, `
				UPDATE assignment_submissions
				SET status = ?, submitted_at = ?, updated_at = ?
				WHERE id = ?`, status, now, now, submissionID)
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO submission_files
			  (submission_id, file_name, file_kind, content_type, file_size, data, uploaded_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (submission_id) DO UPDATE SET
			  file_name = excluded.file_name, file_kind = excluded.file_kind,
			  content_type = excluded.content_type, file_size = excluded.file_size,
			  data = excluded.data, uploaded_at = excluded.uploaded_at`,
			submissionID, name, submissionFileKind(ext), submissionContentType(ext), len(data), data, now)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		submission, err := scanSubmission(db.QueryRowContext(ctx, submissionSelect+` WHERE sub.id = ?`, submissionID))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		code := http.StatusOK
		if created {
			code = http.StatusCreated
		}
		writeJSON(w, code, submission)
	}
}

// downloadSubmissionFile serves the stored bytes to the student who handed them
// in or to somebody who grades the subject. Always an attachment: a submission is
// a file to open locally, never a page to run on this origin.
func downloadSubmissionFile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		caller := callerFrom(r)
		submissionID := r.PathValue("submissionID")

		var studentID string
		err := db.QueryRowContext(ctx,
			`SELECT student_id FROM assignment_submissions WHERE id = ?`, submissionID).Scan(&studentID)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "submission not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if caller.ID != studentID && !caller.can("assignments.manage") {
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error": "only the student who handed this in, or somebody who grades it, can download it",
			})
			return
		}

		var name, contentType, uploadedAt string
		var data []byte
		err = db.QueryRowContext(ctx,
			`SELECT file_name, content_type, data, uploaded_at FROM submission_files WHERE submission_id = ?`,
			submissionID).Scan(&name, &contentType, &data, &uploadedAt)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "this submission has no file"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		h := w.Header()
		h.Set("Content-Type", contentType)
		h.Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
		h.Set("X-Content-Type-Options", "nosniff")
		// A submission is one student's work: it must not sit in a shared cache.
		h.Set("Cache-Control", "no-store")
		modified, _ := time.Parse(time.RFC3339, uploadedAt)
		http.ServeContent(w, r, name, modified, bytes.NewReader(data))
	}
}

// deleteSubmissionFile takes the file back off a submission the student keeps:
// the row and its status stay, exactly what a NULL file column would do.
func deleteSubmissionFile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		caller := callerFrom(r)

		var submissionID string
		err := db.QueryRowContext(ctx, `
			SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?`,
			r.PathValue("assignmentID"), caller.ID).Scan(&submissionID)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "you have not handed this assignment in"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		res, err := db.ExecContext(ctx, `DELETE FROM submission_files WHERE submission_id = ?`, submissionID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "this submission has no file"})
			return
		}
		_, _ = db.ExecContext(ctx,
			`UPDATE assignment_submissions SET updated_at = ? WHERE id = ?`, util.Now(), submissionID)
		w.WriteHeader(http.StatusNoContent)
	}
}

// containsString answers whether the allow-list covers one extension.
func containsString(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}

// allowedTypesLabel is the human form of the allow-list: ".pdf, .docx and .zip".
func allowedTypesLabel(values []string) string {
	dotted := make([]string, len(values))
	for i, value := range values {
		dotted[i] = "." + value
	}
	return strings.Join(dotted, ", ")
}
