package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"optimolms/backend/internal/util"
)

/*
General settings.

The app-wide preferences live in one key/value table (migration 000027), so a new
knob is a row rather than a migration. Values are TEXT, JSON-encoded where they
are structured. Unknown keys are ignored and a missing key falls back to the
default below, so a client always gets a complete, usable set of limits — even on
a database whose rows were hand-edited.

Who may touch them: every signed-in client reads them (the student upload picker
needs the size cap and the extension list before it opens a file dialog), and
only the holder of settings.manage writes them — ADMIN at seed time. See the
route policy in session.go.
*/

const (
	keySubmissionFileTypes = "submission_allowed_file_types"
	keySubmissionMaxFileMB = "submission_max_file_mb"

	// defaultSubmissionMaxFileMB is the cap a fresh install seeds; a scan of a
	// worksheet is a few MB, so 25 leaves room without inviting a video.
	defaultSubmissionMaxFileMB = 25
	minSubmissionMaxFileMB     = 1
	maxSubmissionMaxFileMB     = 100

	// An allow-list is a short list of extensions: one is enough for a strict
	// assignment, and more than 50 is a typo waiting to happen.
	minSubmissionFileTypes = 1
	maxSubmissionFileTypes = 50
	maxFileTypeLength      = 10
)

// defaultSubmissionFileTypes is the allow-list a fresh install seeds: documents,
// slides, spreadsheets, archives and images — the work students actually hand in.
var defaultSubmissionFileTypes = []string{
	"pdf", "docx", "pptx", "xlsx", "zip", "png", "jpg", "jpeg", "txt", "md",
}

// submissionFileTypePattern is what an extension may look like: lowercase
// letters and digits, no dot, no slash, nothing that could walk a path.
var submissionFileTypePattern = regexp.MustCompile(`^[a-z0-9]{1,` + strconv.Itoa(maxFileTypeLength) + `}$`)

// generalSettings is the JSON body of GET and PUT /api/settings/general.
type generalSettings struct {
	SubmissionAllowedFileTypes []string `json:"submission_allowed_file_types"`
	SubmissionMaxFileMB        int      `json:"submission_max_file_mb"`
}

func defaultGeneralSettings() generalSettings {
	return generalSettings{
		SubmissionAllowedFileTypes: append([]string{}, defaultSubmissionFileTypes...),
		SubmissionMaxFileMB:        defaultSubmissionMaxFileMB,
	}
}

func registerGeneralSettings(mux *http.ServeMux, db *sql.DB) {
	// GET /api/settings/general — the limits the upload UI needs, for anybody
	// with a session.
	mux.HandleFunc("GET /api/settings/general", func(w http.ResponseWriter, r *http.Request) {
		out, err := loadGeneralSettings(r.Context(), db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})

	// PUT /api/settings/general — partial writes: a field left out of the body
	// keeps its stored value, which is what the settings tab's per-field save
	// buttons need.
	mux.HandleFunc("PUT /api/settings/general", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SubmissionAllowedFileTypes *[]string `json:"submission_allowed_file_types"`
			SubmissionMaxFileMB        *int      `json:"submission_max_file_mb"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if body.SubmissionAllowedFileTypes == nil && body.SubmissionMaxFileMB == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}

		ctx := r.Context()
		now := util.Now()
		if body.SubmissionAllowedFileTypes != nil {
			types, problem := normalizeSubmissionFileTypes(*body.SubmissionAllowedFileTypes)
			if problem != "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
				return
			}
			encoded, err := json.Marshal(types)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if err := saveSetting(ctx, db, keySubmissionFileTypes, string(encoded), now); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		if body.SubmissionMaxFileMB != nil {
			if *body.SubmissionMaxFileMB < minSubmissionMaxFileMB || *body.SubmissionMaxFileMB > maxSubmissionMaxFileMB {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "submission_max_file_mb must be between 1 and 100",
				})
				return
			}
			if err := saveSetting(ctx, db, keySubmissionMaxFileMB, strconv.Itoa(*body.SubmissionMaxFileMB), now); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}

		out, err := loadGeneralSettings(ctx, db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})
}

// loadGeneralSettings reads the stored rows over the defaults. A row that cannot
// be parsed is skipped rather than reported: one bad key must not take the
// upload picker down with it.
func loadGeneralSettings(ctx context.Context, db *sql.DB) (generalSettings, error) {
	out := defaultGeneralSettings()
	rows, err := db.QueryContext(ctx, `SELECT key, value FROM general_settings`)
	if err != nil {
		return out, err
	}
	defer rows.Close()

	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return out, err
		}
		switch key {
		case keySubmissionFileTypes:
			var types []string
			if err := json.Unmarshal([]byte(value), &types); err != nil || len(types) == 0 {
				continue
			}
			out.SubmissionAllowedFileTypes = types
		case keySubmissionMaxFileMB:
			if size, err := strconv.Atoi(strings.TrimSpace(value)); err == nil && size >= minSubmissionMaxFileMB {
				out.SubmissionMaxFileMB = size
			}
		}
	}
	return out, rows.Err()
}

func saveSetting(ctx context.Context, db *sql.DB, key, value, now string) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO general_settings (key, value, updated_at) VALUES (?, ?, ?)
		ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, value, now)
	return err
}

// normalizeSubmissionFileTypes cleans an administrator's allow-list: "  .PDF "
// becomes "pdf", duplicates collapse, and anything that is not a bare extension
// is a 400 rather than a file name that could escape its folder.
func normalizeSubmissionFileTypes(values []string) ([]string, string) {
	out := make([]string, 0, len(values))
	seen := make(map[string]bool, len(values))
	for _, raw := range values {
		ext := strings.ToLower(strings.TrimLeft(strings.TrimSpace(raw), "."))
		ext = strings.TrimSpace(ext)
		if ext == "" {
			return nil, "every allowed file type needs a name, like pdf"
		}
		if !submissionFileTypePattern.MatchString(ext) {
			return nil, ext + " is not a file extension: use 1 to 10 letters or digits, like pdf"
		}
		if seen[ext] {
			continue
		}
		seen[ext] = true
		out = append(out, ext)
	}
	switch {
	case len(out) < minSubmissionFileTypes:
		return nil, "keep at least one allowed file type"
	case len(out) > maxSubmissionFileTypes:
		return nil, "at most 50 allowed file types"
	}
	return out, ""
}
