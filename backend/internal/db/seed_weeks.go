package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"optimolms/backend/internal/util"
)

// A demo term is four weeks long: enough to show the shape of a course without
// filling the page with empty weeks.
const seedWeekCount = 4

// seededWeek is a week the seed created, kept so content can be filed into it
// by date.
type seededWeek struct {
	id    string
	start time.Time
	end   time.Time
}

// seedCourseWeeks lays the demo subjects out week by week. It only touches
// subjects that have no weeks yet, so an institution's own planning is never
// overwritten, and it files dated content (lectures, assignments) into the week
// it falls in, which is what makes the demo page look like a real term.
func seedCourseWeeks(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `
		SELECT s.id, COALESCE(s.school_year, ''), s.semester
		FROM subjects s
		WHERE NOT EXISTS (SELECT 1 FROM course_weeks w WHERE w.subject_id = s.id)
		  AND (EXISTS (SELECT 1 FROM lectures l WHERE l.subject_id = s.id)
		    OR EXISTS (SELECT 1 FROM assignments a WHERE a.subject_id = s.id)
		    OR EXISTS (SELECT 1 FROM quizzes q WHERE q.subject_id = s.id)
		    OR EXISTS (SELECT 1 FROM flashcards f WHERE f.subject_id = s.id))`)
	if err != nil {
		return fmt.Errorf("list subjects for weeks: %w", err)
	}
	type subjectRow struct {
		id, schoolYear, semester string
	}
	subjects := []subjectRow{}
	for rows.Next() {
		var subject subjectRow
		if err := rows.Scan(&subject.id, &subject.schoolYear, &subject.semester); err != nil {
			rows.Close()
			return fmt.Errorf("scan subject for weeks: %w", err)
		}
		subjects = append(subjects, subject)
	}
	rows.Close()

	for _, subject := range subjects {
		weeks, err := seedWeeksForSubject(ctx, db, subject.id, subject.schoolYear, subject.semester)
		if err != nil {
			return err
		}
		if err := fileContentIntoWeeks(ctx, db, subject.id, weeks); err != nil {
			return err
		}
	}
	return nil
}

// seedWeeksForSubject creates a term of weeks starting on the Monday of the
// earliest scheduled session, and returns them for the content pass.
func seedWeeksForSubject(ctx context.Context, db *sql.DB, subjectID, schoolYear, semester string) ([]seededWeek, error) {
	anchor, ok, err := earliestSessionDate(ctx, db, subjectID)
	if err != nil {
		return nil, err
	}
	if !ok {
		// No dated content: the term starts today, which keeps the demo honest
		// about what is planned and what is not.
		anchor = time.Now().UTC()
	}
	anchor = mondayOf(anchor)

	season := "FALL"
	if semester == "SECOND" {
		season = "SUMMER"
	}
	year := schoolYear
	if year == "" {
		year = seedCurrentYear(ctx, db)
	}

	now := util.Now()
	weeks := make([]seededWeek, 0, seedWeekCount)
	for number := 1; number <= seedWeekCount; number++ {
		start := anchor.AddDate(0, 0, (number-1)*7)
		end := start.AddDate(0, 0, 6)
		id := util.NewID()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO course_weeks (id, subject_id, school_year, season, week_number,
			                          starts_on, ends_on, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, subjectID, nullString(year), season, number,
			start.Format("2006-01-02"), end.Format("2006-01-02"), now, now); err != nil {
			return nil, fmt.Errorf("seed week %d of subject %s: %w", number, subjectID, err)
		}
		weeks = append(weeks, seededWeek{id: id, start: start, end: end})
	}
	return weeks, nil
}

// earliestSessionDate is the first scheduled lecture or assignment of a
// subject. It anchors the term, so seeded weeks line up with seeded content.
func earliestSessionDate(ctx context.Context, db *sql.DB, subjectID string) (time.Time, bool, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT COALESCE(scheduled_at, '') FROM lectures WHERE subject_id = ?
		UNION ALL
		SELECT COALESCE(scheduled_at, '') FROM assignments WHERE subject_id = ?
		UNION ALL
		SELECT COALESCE(due_at, '') FROM assignments WHERE subject_id = ?`,
		subjectID, subjectID, subjectID)
	if err != nil {
		return time.Time{}, false, fmt.Errorf("read session dates: %w", err)
	}
	defer rows.Close()

	var earliest time.Time
	found := false
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return time.Time{}, false, fmt.Errorf("scan session date: %w", err)
		}
		day, ok := parseSeedDay(raw)
		if !ok {
			continue
		}
		if !found || day.Before(earliest) {
			earliest, found = day, true
		}
	}
	if err := rows.Err(); err != nil {
		return time.Time{}, false, err
	}
	return earliest, found, nil
}

// fileContentIntoWeeks puts every dated piece of content into the week that
// contains its date. Content without a date (quizzes, flashcards) is left
// unscheduled on purpose: the page has a place for it.
func fileContentIntoWeeks(ctx context.Context, db *sql.DB, subjectID string, weeks []seededWeek) error {
	type content struct {
		table string
		id    string
		day   time.Time
	}

	sources := []struct {
		table string
		query string
	}{
		{"lectures", `SELECT id, COALESCE(scheduled_at, '') FROM lectures WHERE subject_id = ?`},
		{"assignments", `SELECT id, COALESCE(scheduled_at, due_at, '') FROM assignments WHERE subject_id = ?`},
	}
	items := []content{}
	for _, source := range sources {
		rows, err := db.QueryContext(ctx, source.query, subjectID)
		if err != nil {
			return fmt.Errorf("read content for weeks: %w", err)
		}
		for rows.Next() {
			var id, raw string
			if err := rows.Scan(&id, &raw); err != nil {
				rows.Close()
				return fmt.Errorf("scan content for weeks: %w", err)
			}
			day, ok := parseSeedDay(raw)
			if !ok {
				continue
			}
			items = append(items, content{table: source.table, id: id, day: day})
		}
		rows.Close()
	}

	for _, item := range items {
		for _, week := range weeks {
			if item.day.Before(week.start) || item.day.After(week.end) {
				continue
			}
			if _, err := db.ExecContext(ctx,
				`UPDATE `+item.table+` SET week_id = ? WHERE id = ?`, week.id, item.id); err != nil {
				return fmt.Errorf("file content into week: %w", err)
			}
			break
		}
	}
	return nil
}

// parseSeedDay reads the date part of a stored timestamp (RFC3339 or a bare
// calendar date).
func parseSeedDay(raw string) (time.Time, bool) {
	raw = raw[:min(len(raw), 10)]
	day, err := time.Parse("2006-01-02", raw)
	if err != nil {
		return time.Time{}, false
	}
	return day, true
}

// mondayOf is the Monday of the week a date falls in. Weeks read Monday to
// Sunday, the way a timetable does.
func mondayOf(day time.Time) time.Time {
	offset := (int(day.Weekday()) + 6) % 7
	return time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.UTC).
		AddDate(0, 0, -offset)
}
