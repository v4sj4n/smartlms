-- 000021: flashcards live in sets
-- A set (deck) is the content item a subject offers and a week holds: it has a
-- title, an optional description and an ordered list of front/back cards.
-- Existing loose cards are gathered into one set per subject and week.

CREATE TABLE flashcard_sets (
  id          TEXT PRIMARY KEY,
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  week_id     TEXT REFERENCES course_weeks(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX flashcard_sets_subject_idx ON flashcard_sets (subject_id);
CREATE INDEX flashcard_sets_week_idx    ON flashcard_sets (week_id);

ALTER TABLE flashcards ADD COLUMN set_id   TEXT REFERENCES flashcard_sets(id) ON DELETE CASCADE;
ALTER TABLE flashcards ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

-- One set per (subject, week) that already has cards.
INSERT INTO flashcard_sets (id, subject_id, title, description, week_id, created_at, updated_at)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-a'
             || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       subject_id, 'Flashcards', '', week_id, MIN(created_at), MAX(updated_at)
FROM flashcards
GROUP BY subject_id, week_id;

UPDATE flashcards SET set_id = (
  SELECT s.id FROM flashcard_sets s
  WHERE s.subject_id = flashcards.subject_id
    AND s.week_id IS flashcards.week_id
);

UPDATE flashcards SET position = (
  SELECT COUNT(*) FROM flashcards f
  WHERE f.set_id = flashcards.set_id
    AND (f.created_at < flashcards.created_at
         OR (f.created_at = flashcards.created_at AND f.id < flashcards.id))
);

-- Weeks now hold sets, not single cards.
DROP INDEX flashcards_week_idx;
ALTER TABLE flashcards DROP COLUMN week_id;
CREATE INDEX flashcards_set_idx ON flashcards (set_id, position);
