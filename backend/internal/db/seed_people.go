package db

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"smartlms/backend/internal/auth"
	"smartlms/backend/internal/util"
)

// Demo population: enough students and lecturers that lists, pagination,
// gradebooks and enrollments look like a real school. Generated from a fixed
// seed so every fresh database gets the same people.
const (
	seedPeopleStudents  = 48
	seedPeopleLecturers = 7
	seedPeoplePassword  = "password123"
	seedPeopleDomain    = "people.smartlms.dev"
	seedPeopleRandSeed  = 20261120
)

var seedFirstNames = []string{
	"Arta", "Besnik", "Drita", "Elira", "Flori", "Gentiana", "Ilir", "Jonida",
	"Klea", "Ledio", "Mirela", "Noel", "Orges", "Rina", "Sokol", "Tea",
	"Uendi", "Valon", "Xhesika", "Ylli", "Ana", "Marco", "Sofia", "Lucas",
	"Amira", "Daniel", "Hana", "Mateo", "Nora", "Omar", "Priya", "Sven",
	"Lea", "Kenji", "Zara", "Elias", "Mila", "Tomás", "Yara", "Leon",
}

var seedLastNames = []string{
	"Hoxha", "Krasniqi", "Shehu", "Gashi", "Berisha", "Leka", "Dervishi", "Kola",
	"Marku", "Prifti", "Rama", "Tafa", "Zeneli", "Basha", "Çela", "Dushku",
	"Rossi", "Müller", "García", "Novak", "Haddad", "Okafor", "Tanaka", "Lindqvist",
	"Moreau", "Kowalski", "Silva", "Petrović", "Nakamura", "O'Brien",
}

// seedPeople adds the generated users once (marker: any user on the demo
// domain), enrolls the students in the sample subjects and grades the
// components that are already marked, so the gradebook has a spread.
func seedPeople(ctx context.Context, db *sql.DB, roleID map[string]string) error {
	var existing int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE email LIKE ?`,
		"%@"+seedPeopleDomain).Scan(&existing); err != nil {
		return fmt.Errorf("count demo people: %w", err)
	}
	if existing > 0 {
		return seedGradebooks(ctx, db)
	}

	// One hash for everyone: bcrypt per user would add seconds to first boot.
	hash, err := auth.HashPassword(seedPeoplePassword)
	if err != nil {
		return fmt.Errorf("hash demo password: %w", err)
	}

	rng := rand.New(rand.NewSource(seedPeopleRandSeed))
	usedEmails := map[string]bool{}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	insert := func(role string) (string, error) {
		first := seedFirstNames[rng.Intn(len(seedFirstNames))]
		last := seedLastNames[rng.Intn(len(seedLastNames))]
		base := emailLocalPart(first) + "." + emailLocalPart(last)
		email := base + "@" + seedPeopleDomain
		for n := 2; usedEmails[email]; n++ {
			email = fmt.Sprintf("%s%d@%s", base, n, seedPeopleDomain)
		}
		usedEmails[email] = true

		// Joined at some point in the last ~10 months.
		joined := time.Now().UTC().Add(-time.Duration(rng.Intn(300*24)) * time.Hour)
		stamp := joined.Format(time.RFC3339)
		id := util.NewID()
		if _, err := tx.ExecContext(ctx, `INSERT INTO users (id, email, password_hash, name, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, email, hash, first+" "+last, roleID[role], stamp, stamp); err != nil {
			return "", fmt.Errorf("seed person %s: %w", email, err)
		}
		return id, nil
	}

	for i := 0; i < seedPeopleLecturers; i++ {
		if _, err := insert("LECTURER"); err != nil {
			return err
		}
	}
	studentIDs := make([]string, 0, seedPeopleStudents)
	for i := 0; i < seedPeopleStudents; i++ {
		id, err := insert("STUDENT")
		if err != nil {
			return err
		}
		studentIDs = append(studentIDs, id)
	}

	if err := enrollAndGrade(ctx, tx, rng, studentIDs); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return seedGradebooks(ctx, db)
}

// seedGradebooks gives every subject a midterm/final/engagement split and
// marks the enrolled students on the midterm and engagement. It runs only while
// the database has no grade components at all, so a lecturer's own gradebook
// is never touched or recreated.
func seedGradebooks(ctx context.Context, db *sql.DB) error {
	var components int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM grade_components`).Scan(&components); err != nil {
		return fmt.Errorf("count grade components: %w", err)
	}
	if components > 0 {
		return nil
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	type subject struct{ id, lecturer string }
	var subjects []subject
	rows, err := tx.QueryContext(ctx, `SELECT id, COALESCE(lecturer_id, '') FROM subjects`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var sub subject
		if err := rows.Scan(&sub.id, &sub.lecturer); err != nil {
			rows.Close()
			return err
		}
		subjects = append(subjects, sub)
	}
	rows.Close()

	rng := rand.New(rand.NewSource(seedPeopleRandSeed + 1))
	now := util.Now()
	parts := []struct {
		name, kind string
		weight     float64
		graded     bool
	}{
		{"Midterm exam", "midterm", 40, true},
		{"Final exam", "final", 50, false},
		{"Engagement", "engagement", 10, true},
	}
	for _, sub := range subjects {
		var lecturer any
		if sub.lecturer != "" {
			lecturer = sub.lecturer
		}
		students, err := queryStrings(ctx, tx, `SELECT student_id FROM enrollments WHERE subject_id = ?`, sub.id)
		if err != nil {
			return err
		}
		for i, part := range parts {
			componentID := util.NewID()
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO grade_components (id, subject_id, name, type, weight_percent, max_points,
				                              order_index, is_published, created_by, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, 100, ?, 1, ?, ?, ?)`,
				componentID, sub.id, part.name, part.kind, part.weight, i, lecturer, now, now); err != nil {
				return fmt.Errorf("seed grade component: %w", err)
			}
			if !part.graded {
				continue
			}
			for _, studentID := range students {
				points := clampFloat(72+rng.NormFloat64()*15, 0, 100)
				points = float64(int(points*2+0.5)) / 2
				if _, err := tx.ExecContext(ctx, `
					INSERT OR IGNORE INTO grade_entries (id, component_id, student_id, points, graded_by, graded_at, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					util.NewID(), componentID, studentID, points, lecturer, now, now, now); err != nil {
					return fmt.Errorf("seed grade entry: %w", err)
				}
			}
		}
	}
	return tx.Commit()
}

// enrollAndGrade puts most students in each existing subject and gives the
// enrolled ones marks on every component that already has a graded entry.
func enrollAndGrade(ctx context.Context, tx *sql.Tx, rng *rand.Rand, studentIDs []string) error {
	subjects, err := queryStrings(ctx, tx, `SELECT id FROM subjects`)
	if err != nil {
		return err
	}
	now := util.Now()
	for _, subjectID := range subjects {
		// Components someone has already marked, plus who marked them.
		type graded struct{ id, grader string }
		var components []graded
		rows, err := tx.QueryContext(ctx, `
			SELECT c.id, COALESCE(MIN(e.graded_by), '')
			FROM grade_components c JOIN grade_entries e ON e.component_id = c.id
			WHERE c.subject_id = ? GROUP BY c.id`, subjectID)
		if err != nil {
			return err
		}
		for rows.Next() {
			var g graded
			if err := rows.Scan(&g.id, &g.grader); err != nil {
				rows.Close()
				return err
			}
			components = append(components, g)
		}
		rows.Close()

		for _, studentID := range studentIDs {
			if rng.Float64() > 0.7 {
				continue // ~70% of students take each subject
			}
			if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO enrollments (id, student_id, subject_id, enrolled_at) VALUES (?, ?, ?, ?)`,
				util.NewID(), studentID, subjectID, now); err != nil {
				return fmt.Errorf("enroll demo student: %w", err)
			}
			for _, component := range components {
				// Roughly normal around 72, clamped to 0-100.
				points := clampFloat(72+rng.NormFloat64()*15, 0, 100)
				points = float64(int(points*2+0.5)) / 2 // half-point steps
				var grader any
				if component.grader != "" {
					grader = component.grader
				}
				if _, err := tx.ExecContext(ctx, `
					INSERT OR IGNORE INTO grade_entries (id, component_id, student_id, points, graded_by, graded_at, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					util.NewID(), component.id, studentID, points, grader, now, now, now); err != nil {
					return fmt.Errorf("grade demo student: %w", err)
				}
			}
		}
	}
	return nil
}

func queryStrings(ctx context.Context, tx *sql.Tx, query string, args ...any) ([]string, error) {
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// emailLocalPart lowercases a name and folds the accented letters the name
// lists use, so addresses stay plain ASCII.
func emailLocalPart(name string) string {
	replacer := strings.NewReplacer(
		"ç", "c", "Ç", "c", "ë", "e", "ü", "u", "ö", "o", "á", "a", "é", "e",
		"ć", "c", "í", "i", "'", "",
	)
	return strings.ToLower(replacer.Replace(name))
}

func clampFloat(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
