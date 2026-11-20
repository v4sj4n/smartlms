package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"optimolms/backend/internal/util"
)

/* ---------- flashcard sets ----------
 * A set is the content item: a titled deck, optionally filed under a week,
 * holding an ordered list of two-sided cards. Cards are only written through
 * their set: saving a set with `cards` replaces the whole deck, in order.
 */

type flashcardOut struct {
	ID    string `json:"id"`
	Front string `json:"front"`
	Back  string `json:"back"`
}

type flashcardSetOut struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Description string         `json:"description,omitempty"`
	WeekID      string         `json:"week_id,omitempty"`
	Cards       []flashcardOut `json:"cards"`
}

type flashcardInput struct {
	Front string `json:"front"`
	Back  string `json:"back"`
}

// maxCardsPerSet keeps one deck to something a student can study in a sitting
// and a single request can carry.
const maxCardsPerSet = 500

// cleanCards trims every card and rejects a deck with a half-filled card.
func cleanCards(cards []flashcardInput) ([]flashcardInput, error) {
	if len(cards) > maxCardsPerSet {
		return nil, fmt.Errorf("a set holds at most %d cards", maxCardsPerSet)
	}
	out := make([]flashcardInput, 0, len(cards))
	for index, card := range cards {
		front, back := strings.TrimSpace(card.Front), strings.TrimSpace(card.Back)
		if front == "" || back == "" {
			return nil, fmt.Errorf("card %d needs both a front and a back", index+1)
		}
		out = append(out, flashcardInput{Front: front, Back: back})
	}
	return out, nil
}

// replaceCards swaps a set's deck for cards, in order, inside tx.
func replaceCards(ctx context.Context, tx *sql.Tx, subjectID, setID string, cards []flashcardInput) ([]flashcardOut, error) {
	if _, err := tx.ExecContext(ctx, `DELETE FROM flashcards WHERE set_id = ?`, setID); err != nil {
		return nil, err
	}
	now := util.Now()
	out := make([]flashcardOut, 0, len(cards))
	for position, card := range cards {
		id := util.NewID()
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO flashcards (id, subject_id, set_id, position, front, back, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, subjectID, setID, position, card.Front, card.Back, now, now); err != nil {
			return nil, err
		}
		out = append(out, flashcardOut{ID: id, Front: card.Front, Back: card.Back})
	}
	return out, nil
}

// insertFlashcardSet creates a set with its cards in one transaction.
// weekID must already be validated with weekPlacement.
func insertFlashcardSet(ctx context.Context, db *sql.DB, subjectID, title, description string, weekID any, cards []flashcardInput) (flashcardSetOut, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return flashcardSetOut{}, err
	}
	defer tx.Rollback()

	id, now := util.NewID(), util.Now()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO flashcard_sets (id, subject_id, title, description, week_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, subjectID, title, description, weekID, now, now); err != nil {
		return flashcardSetOut{}, err
	}
	saved, err := replaceCards(ctx, tx, subjectID, id, cards)
	if err != nil {
		return flashcardSetOut{}, err
	}
	if err := tx.Commit(); err != nil {
		return flashcardSetOut{}, err
	}
	week, _ := weekID.(string)
	return flashcardSetOut{ID: id, Title: title, Description: description, WeekID: week, Cards: saved}, nil
}

// loadFlashcardSets returns every set of a subject with its cards, in order.
func loadFlashcardSets(ctx context.Context, db *sql.DB, subjectID string) ([]flashcardSetOut, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, title, description, COALESCE(week_id, '')
		FROM flashcard_sets WHERE subject_id = ? ORDER BY created_at, title`, subjectID)
	if err != nil {
		return nil, err
	}
	sets := []flashcardSetOut{}
	index := map[string]int{}
	for rows.Next() {
		set := flashcardSetOut{Cards: []flashcardOut{}}
		if err := rows.Scan(&set.ID, &set.Title, &set.Description, &set.WeekID); err != nil {
			rows.Close()
			return nil, err
		}
		index[set.ID] = len(sets)
		sets = append(sets, set)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	cardRows, err := db.QueryContext(ctx, `
		SELECT id, set_id, front, back FROM flashcards
		WHERE subject_id = ? AND set_id IS NOT NULL ORDER BY position, created_at`, subjectID)
	if err != nil {
		return nil, err
	}
	defer cardRows.Close()
	for cardRows.Next() {
		var card flashcardOut
		var setID string
		if err := cardRows.Scan(&card.ID, &setID, &card.Front, &card.Back); err != nil {
			return nil, err
		}
		if i, ok := index[setID]; ok {
			sets[i].Cards = append(sets[i].Cards, card)
		}
	}
	return sets, cardRows.Err()
}

func createFlashcardSet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		subjectID := r.PathValue("id")
		var body struct {
			Title       string           `json:"title"`
			Description string           `json:"description"`
			WeekID      string           `json:"week_id"`
			Cards       []flashcardInput `json:"cards"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		title := strings.TrimSpace(body.Title)
		if title == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
			return
		}
		cards, err := cleanCards(body.Cards)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if !rowExists(r.Context(), db, "subjects", subjectID) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subject not found"})
			return
		}
		weekID, problem := weekPlacement(r.Context(), db, subjectID, body.WeekID)
		if problem != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
			return
		}
		set, err := insertFlashcardSet(r.Context(), db, subjectID, title, strings.TrimSpace(body.Description), weekID, cards)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, set)
	}
}

func patchFlashcardSet(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setID := r.PathValue("id")
		var body struct {
			Title       *string           `json:"title"`
			Description *string           `json:"description"`
			WeekID      *string           `json:"week_id"`
			Cards       *[]flashcardInput `json:"cards"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		subjectID, ok := subjectOf(r.Context(), db, "flashcard_sets", setID)
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "flashcard set not found"})
			return
		}

		var b setBuilder
		if body.Title != nil {
			if strings.TrimSpace(*body.Title) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title cannot be empty"})
				return
			}
			b.set("title", strings.TrimSpace(*body.Title))
		}
		if body.Description != nil {
			b.set("description", strings.TrimSpace(*body.Description))
		}
		if body.WeekID != nil {
			weekID, problem := weekPlacement(r.Context(), db, subjectID, *body.WeekID)
			if problem != "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
				return
			}
			b.set("week_id", weekID)
		}
		var cards []flashcardInput
		if body.Cards != nil {
			cleaned, err := cleanCards(*body.Cards)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			cards = cleaned
		}
		if b.empty() && body.Cards == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nothing to update"})
			return
		}

		if err := updateFlashcardSet(r.Context(), db, subjectID, setID, &b, body.Cards != nil, cards); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func updateFlashcardSet(ctx context.Context, db *sql.DB, subjectID, setID string, b *setBuilder, withCards bool, cards []flashcardInput) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	b.set("updated_at", util.Now())
	args := append(append([]any{}, b.args...), setID)
	result, err := tx.ExecContext(ctx,
		`UPDATE flashcard_sets SET `+strings.Join(b.sets, ", ")+` WHERE id = ?`, args...)
	if err != nil {
		return err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return errors.New("flashcard set not found")
	}
	if withCards {
		if _, err := replaceCards(ctx, tx, subjectID, setID, cards); err != nil {
			return err
		}
	}
	return tx.Commit()
}
