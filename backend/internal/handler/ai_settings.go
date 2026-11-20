package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"optimolms/backend/internal/util"
)

// Per-user assistant preferences, served to everybody: the session says whose
// they are, so a client cannot read or write somebody else's.
type aiSettingsOut struct {
	UserID        string   `json:"user_id"`
	AssistantName string   `json:"assistant_name"`
	SystemPrompt  string   `json:"system_prompt"`
	DisplayName   string   `json:"display_name"`
	Occupation    string   `json:"occupation"`
	Traits        []string `json:"traits"`
	Notes         string   `json:"notes"`
	// Cap on reply length in tokens; 0 leaves it to the provider.
	MaxOutputTokens int    `json:"max_output_tokens"`
	UpdatedAt       string `json:"updated_at,omitempty"`
}

const (
	maxAssistantName = 80
	maxSystemPrompt  = 4000
	maxDisplayName   = 80
	maxOccupation    = 120
	maxNoteLength    = 3000
	maxTraits        = 12
	maxTraitLength   = 100
	minOutputTokens  = 64
	maxOutputTokens  = 32000
)

func defaultAISettings(userID string) aiSettingsOut {
	return aiSettingsOut{
		UserID:        userID,
		AssistantName: "AI Assistant",
		Traits:        []string{},
	}
}

func loadAISettings(ctx context.Context, db *sql.DB, userID string) (aiSettingsOut, error) {
	out := defaultAISettings(userID)
	var traits string
	err := db.QueryRowContext(ctx, `
		SELECT assistant_name, system_prompt, display_name, occupation, traits, notes, max_output_tokens, updated_at
		FROM user_ai_settings WHERE user_id = ?`, userID).
		Scan(&out.AssistantName, &out.SystemPrompt, &out.DisplayName,
			&out.Occupation, &traits, &out.Notes, &out.MaxOutputTokens, &out.UpdatedAt)
	if err == sql.ErrNoRows {
		return out, nil
	}
	if err != nil {
		return aiSettingsOut{}, err
	}
	if err := json.Unmarshal([]byte(traits), &out.Traits); err != nil {
		out.Traits = []string{}
	}
	if out.Traits == nil {
		out.Traits = []string{}
	}
	return out, nil
}

func registerAISettings(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/ai/settings", func(w http.ResponseWriter, r *http.Request) {
		out, err := loadAISettings(r.Context(), db, callerFrom(r).ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})

	mux.HandleFunc("PUT /api/ai/settings", func(w http.ResponseWriter, r *http.Request) {
		var req aiSettingsOut
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		// The body carries preferences only: whose they are is the session's
		// answer, and the echoed user_id below is set from it.
		userID := callerFrom(r).ID
		req.UserID = userID

		req.AssistantName = strings.TrimSpace(req.AssistantName)
		req.DisplayName = strings.TrimSpace(req.DisplayName)
		req.Occupation = strings.TrimSpace(req.Occupation)
		req.Notes = strings.TrimSpace(req.Notes)
		// System prompt keeps interior whitespace; only its edges are trimmed.
		req.SystemPrompt = strings.TrimSpace(req.SystemPrompt)

		switch {
		case len(req.AssistantName) > maxAssistantName:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Name must be 80 characters or fewer"})
			return
		case req.AssistantName == "":
			req.AssistantName = "AI Assistant"
		case len(req.SystemPrompt) > maxSystemPrompt:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "System prompt must be 4000 characters or fewer"})
			return
		case len(req.DisplayName) > maxDisplayName:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Display name must be 80 characters or fewer"})
			return
		case len(req.Occupation) > maxOccupation:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Occupation must be 120 characters or fewer"})
			return
		case len(req.Notes) > maxNoteLength:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Notes must be 3000 characters or fewer"})
			return
		case req.MaxOutputTokens != 0 && (req.MaxOutputTokens < minOutputTokens || req.MaxOutputTokens > maxOutputTokens):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Max output tokens must be between 64 and 32000, or 0 for no limit"})
			return
		case len(req.Traits) > maxTraits:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "At most 12 traits are allowed"})
			return
		}

		cleanTraits := make([]string, 0, len(req.Traits))
		for _, trait := range req.Traits {
			trait = strings.TrimSpace(trait)
			if trait == "" || len(trait) > maxTraitLength {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Each trait must be 100 characters or fewer"})
				return
			}
			if !slices.Contains(cleanTraits, trait) {
				cleanTraits = append(cleanTraits, trait)
			}
		}
		req.Traits = cleanTraits

		traitsJSON, err := json.Marshal(req.Traits)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		now := util.Now()
		if _, err := db.ExecContext(r.Context(), `
			INSERT INTO user_ai_settings
				(user_id, assistant_name, system_prompt, display_name, occupation, traits, notes, max_output_tokens, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				assistant_name = excluded.assistant_name,
				system_prompt  = excluded.system_prompt,
				display_name   = excluded.display_name,
				occupation     = excluded.occupation,
				traits         = excluded.traits,
				notes          = excluded.notes,
				max_output_tokens = excluded.max_output_tokens,
				updated_at     = excluded.updated_at`,
			userID, req.AssistantName, req.SystemPrompt, req.DisplayName,
			req.Occupation, string(traitsJSON), req.Notes, req.MaxOutputTokens, now); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		out, err := loadAISettings(r.Context(), db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})
}
