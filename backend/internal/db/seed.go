package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"smartlms/backend/internal/auth"
	"smartlms/backend/internal/util"
)

// module key -> human name
var seedModules = map[string]string{
	"dashboard":  "Dashboard",
	"users":      "User management",
	"campuses":   "Campuses, stories & classes",
	"courses":    "Courses",
	"subjects":   "Subjects",
	"lectures":   "Lectures",
	"seminars":   "Seminars",
	"quizzes":    "Quizzes",
	"flashcards": "Flashcards",
	"students":   "Students & enrollments",
	"settings":   "Settings",
}

type seedPermission struct {
	key   string
	label string
	desc  string
}

// each module owns its own named permissions
var seedPermissions = map[string][]seedPermission{
	"dashboard": {
		{"dashboard.view", "View dashboard", "See the dashboard overview"},
	},
	"users": {
		{"users.view", "View users", "List and inspect user accounts"},
		{"users.manage", "Manage users", "Create, edit, lock and delete users"},
	},
	"campuses": {
		{"campuses.view", "View campuses", "See campuses, stories and classes"},
		{"campuses.manage", "Manage campuses", "Add, edit and remove campuses, stories and classes"},
	},
	"courses": {
		{"courses.view", "View courses", "See courses and their content"},
		{"courses.manage", "Manage courses", "Create, edit and remove courses"},
	},
	"subjects": {
		{"subjects.view", "View subjects", "See subjects and their lecturers"},
		{"subjects.manage", "Manage subjects", "Create, edit and remove subjects"},
	},
	"lectures": {
		{"lectures.view", "View lectures", "See lectures and their rooms"},
		{"lectures.manage", "Manage lectures", "Create, schedule, edit and remove lectures"},
	},
	"seminars": {
		{"seminars.view", "View seminars", "See seminars and their rooms"},
		{"seminars.manage", "Manage seminars", "Create, schedule, edit and remove seminars"},
	},
	"quizzes": {
		{"quizzes.view", "View quizzes", "See quizzes and question banks"},
		{"quizzes.manage", "Manage quizzes", "Create, edit and remove quizzes"},
		{"quizzes.take", "Take quizzes", "Attempt quizzes and see own results"},
	},
	"flashcards": {
		{"flashcards.view", "View flashcards", "Study flashcard decks"},
		{"flashcards.manage", "Manage flashcards", "Create, edit and remove flashcards"},
	},
	"students": {
		{"students.view", "View students", "See students and their enrollments"},
		{"students.manage", "Manage students", "Enroll and unenroll students"},
	},
	"settings": {
		{"settings.view", "View settings", "See system and role settings"},
		{"settings.manage", "Manage settings", "Change system and role settings"},
	},
}

// role -> permission keys granted at seed time ("*" = every permission)
var seedRoleGrants = map[string][]string{
	"ADMIN": {"*"},
	"LECTURER": {
		"dashboard.view",
		"courses.view", "courses.manage",
		"subjects.view", "subjects.manage",
		"lectures.view", "lectures.manage",
		"seminars.view", "seminars.manage",
		"quizzes.view", "quizzes.manage",
		"flashcards.view", "flashcards.manage",
		"students.view",
	},
	"STUDENT": {
		"dashboard.view",
		"courses.view",
		"lectures.view",
		"seminars.view",
		"quizzes.view", "quizzes.take",
		"flashcards.view",
	},
}

// role -> module keys the role can access (ADMIN is additionally a wildcard in code)
var seedRoleModules = map[string][]string{
	"ADMIN":    {"dashboard", "users", "campuses", "courses", "subjects", "lectures", "seminars", "quizzes", "flashcards", "students", "settings"},
	"LECTURER": {"dashboard", "courses", "subjects", "lectures", "seminars", "quizzes", "flashcards", "students"},
	"STUDENT":  {"dashboard", "courses", "lectures", "seminars", "quizzes", "flashcards"},
}

type seedUser struct {
	email    string
	password string
	name     string
	role     string
}

var seedUsers = []seedUser{
	{"admin@smartlms.dev", "admin123", "Admin User", "ADMIN"},
	{"lecturer@smartlms.dev", "lecturer123", "Lecturer User", "LECTURER"},
	{"student@smartlms.dev", "student123", "Student User", "STUDENT"},
}

// Seed inserts the predefined roles, modules, permissions, role_modules and the
// three demo users, plus a small sample of the school structure and content.
// It is idempotent: existing rows are left untouched.
func Seed(ctx context.Context, db *sql.DB) error {
	// predefined lockout per role: 0 means NULL = unlimited login attempts
	roleLockout := map[string]int{"ADMIN": 0, "LECTURER": 5, "STUDENT": 5}
	roleID := map[string]string{}
	for _, role := range []string{"ADMIN", "LECTURER", "STUDENT"} {
		id := util.NewID()
		var maxAttempts any // nil -> NULL -> unlimited tries
		if n := roleLockout[role]; n > 0 {
			maxAttempts = n
		}
		if _, err := db.ExecContext(ctx, `INSERT OR IGNORE INTO roles (id, name, max_login_attempts, lock_minutes) VALUES (?, ?, ?, ?)`,
			id, role, maxAttempts, 15); err != nil {
			return fmt.Errorf("seed role %s: %w", role, err)
		}
		var existing string
		if err := db.QueryRowContext(ctx, `SELECT id FROM roles WHERE name = ?`, role).Scan(&existing); err != nil {
			return fmt.Errorf("lookup role %s: %w", role, err)
		}
		roleID[role] = existing
	}

	moduleID := map[string]string{}
	for key, name := range seedModules {
		id := util.NewID()
		if _, err := db.ExecContext(ctx, `INSERT OR IGNORE INTO modules (id, key, name, description) VALUES (?, ?, ?, ?)`,
			id, key, name, "module "+key); err != nil {
			return fmt.Errorf("seed module %s: %w", key, err)
		}
		var existing string
		if err := db.QueryRowContext(ctx, `SELECT id FROM modules WHERE key = ?`, key).Scan(&existing); err != nil {
			return fmt.Errorf("lookup module %s: %w", key, err)
		}
		moduleID[key] = existing
	}

	for moduleKey, perms := range seedPermissions {
		for _, p := range perms {
			if _, err := db.ExecContext(ctx, `INSERT OR IGNORE INTO permissions (id, module_id, key, label, description) VALUES (?, ?, ?, ?, ?)`,
				util.NewID(), moduleID[moduleKey], p.key, p.label, p.desc); err != nil {
				return fmt.Errorf("seed permission %s: %w", p.key, err)
			}
		}
	}

	allKeys := []string{}
	for _, perms := range seedPermissions {
		for _, p := range perms {
			allKeys = append(allKeys, p.key)
		}
	}
	for role, keys := range seedRoleGrants {
		granted := keys
		if len(keys) == 1 && keys[0] == "*" {
			granted = allKeys
		}
		for _, key := range granted {
			if _, err := db.ExecContext(ctx, `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT ?, id FROM permissions WHERE key = ?`,
				roleID[role], key); err != nil {
				return fmt.Errorf("seed role_permission %s->%s: %w", role, key, err)
			}
		}
	}

	for role, keys := range seedRoleModules {
		for _, key := range keys {
			if _, err := db.ExecContext(ctx, `INSERT OR IGNORE INTO role_modules (role_id, module_id) VALUES (?, ?)`,
				roleID[role], moduleID[key]); err != nil {
				return fmt.Errorf("seed role_module %s->%s: %w", role, key, err)
			}
		}
	}

	for _, u := range seedUsers {
		var existing string
		err := db.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, u.email).Scan(&existing)
		if err == nil {
			continue // already seeded
		}
		if err != sql.ErrNoRows {
			return fmt.Errorf("lookup user %s: %w", u.email, err)
		}
		hash, err := auth.HashPassword(u.password)
		if err != nil {
			return fmt.Errorf("hash password for %s: %w", u.email, err)
		}
		now := util.Now()
		if _, err := db.ExecContext(ctx, `INSERT INTO users (id, email, password_hash, name, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			util.NewID(), u.email, string(hash), u.name, roleID[u.role], now, now); err != nil {
			return fmt.Errorf("seed user %s: %w", u.email, err)
		}
	}

	if err := seedSample(ctx, db, roleID); err != nil {
		return err
	}
	if err := seedNotifications(ctx, db); err != nil {
		return err
	}
	return nil
}

// seedNotifications gives every demo user a small, idempotent notification feed.
func seedNotifications(ctx context.Context, db *sql.DB) error {
	feeds := map[string][][2]string{
		"ADMIN": {
			{"Welcome to SmartLMS", "You have full access to every module and permission."},
			{"Campus ready", "Main Campus and its rooms are ready for scheduling."},
		},
		"LECTURER": {
			{"Course assigned", "You teach Calculus I this term."},
			{"Student enrolled", "Student User enrolled in Calculus I."},
		},
		"STUDENT": {
			{"Welcome to SmartLMS", "Your Calculus I enrollment is active."},
			{"New quiz available", "Limits basics is open — 10 minutes, 2 questions."},
		},
	}

	for _, u := range seedUsers {
		var userID string
		if err := db.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, u.email).Scan(&userID); err != nil {
			return fmt.Errorf("lookup user %s: %w", u.email, err)
		}
		var count int
		if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM notifications WHERE user_id = ?`, userID).Scan(&count); err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		now := util.Now()
		for _, item := range feeds[u.role] {
			if _, err := db.ExecContext(ctx, `INSERT INTO notifications (id, user_id, title, message, created_at) VALUES (?, ?, ?, ?, ?)`,
				util.NewID(), userID, item[0], item[1], now); err != nil {
				return fmt.Errorf("seed notification for %s: %w", u.email, err)
			}
		}
	}
	return nil
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}

// seedSample creates one campus with stories/classes, one subject taught by the
// lecturer, a lecture, a seminar, a quiz with questions, flashcards, and enrolls
// the demo student. Skipped entirely once any campus exists.
func seedSample(ctx context.Context, db *sql.DB, roleID map[string]string) error {
	var count int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM campuses`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	userID := map[string]string{}
	for _, u := range seedUsers {
		var id string
		if err := db.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, u.email).Scan(&id); err != nil {
			return err
		}
		userID[u.role] = id
	}

	now := util.Now()
	campusID := util.NewID()
	if _, err := db.ExecContext(ctx, `INSERT INTO campuses (id, name, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		campusID, "Main Campus", "1 University Ave", now, now); err != nil {
		return err
	}

	classIDs := map[string]string{}
	storyDefs := []struct {
		floor int
		name  string
		rooms []struct {
			name     string
			capacity int
			tags     []string
		}
	}{
		{1, "Ground floor", []struct {
			name     string
			capacity int
			tags     []string
		}{
			{"A101", 40, []string{"projector"}},
			{"A102", 24, []string{"computers", "lab"}},
		}},
		{2, "First floor", []struct {
			name     string
			capacity int
			tags     []string
		}{
			{"B201", 60, []string{"projector", "whiteboard"}},
		}},
	}
	for _, s := range storyDefs {
		storyID := util.NewID()
		if _, err := db.ExecContext(ctx, `INSERT INTO stories (id, campus_id, floor_number, name) VALUES (?, ?, ?, ?)`,
			storyID, campusID, s.floor, s.name); err != nil {
			return err
		}
		for _, r := range s.rooms {
			classID := util.NewID()
			if _, err := db.ExecContext(ctx, `INSERT INTO classes (id, story_id, name, capacity, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				classID, storyID, r.name, r.capacity, mustJSON(r.tags), now, now); err != nil {
				return err
			}
			classIDs[r.name] = classID
		}
	}

	subjectID := util.NewID()
	if _, err := db.ExecContext(ctx, `INSERT INTO subjects (id, name, code, description, lecturer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		subjectID, "Mathematics I", "MATH101", "Limits, derivatives and integrals.", userID["LECTURER"], now, now); err != nil {
		return err
	}

	courseID := util.NewID()
	if _, err := db.ExecContext(ctx, `INSERT INTO courses (id, subject_id, lecturer_id, name, code, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		courseID, subjectID, userID["LECTURER"], "Calculus I", "CALC101", "First-semester calculus course.", now, now); err != nil {
		return err
	}

	if _, err := db.ExecContext(ctx, `INSERT INTO lectures (id, course_id, class_id, title, description, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		util.NewID(), courseID, classIDs["B201"], "Introduction to limits", "Epsilon-delta intuition.", "2026-11-23T09:00:00Z", now, now); err != nil {
		return err
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO seminars (id, course_id, class_id, title, description, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		util.NewID(), courseID, classIDs["A102"], "Derivative exercises", "Worksheet on the chain rule.", "2026-11-24T11:00:00Z", now, now); err != nil {
		return err
	}

	quizID := util.NewID()
	if _, err := db.ExecContext(ctx, `INSERT INTO quizzes (id, course_id, title, description, time_limit_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		quizID, courseID, "Limits basics", "Short quiz on limits.", 10, now, now); err != nil {
		return err
	}
	questions := []struct {
		typ    string
		prompt string
		opts   []string
		answer any
		points int
	}{
		{"mcq", "What is lim(x->0) sin(x)/x?", []string{"0", "1", "-1", "undefined"}, 1, 1},
		{"true_false", "A function can have a limit at a point where it is not defined.", nil, true, 1},
	}
	for i, q := range questions {
		if _, err := db.ExecContext(ctx, `INSERT INTO quiz_questions (id, quiz_id, type, prompt, options, answer, points, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			util.NewID(), quizID, q.typ, q.prompt, mustJSON(q.opts), mustJSON(q.answer), q.points, i); err != nil {
			return err
		}
	}

	flashcards := [][2]string{
		{"What is the derivative of x^2?", "2x"},
		{"What is the integral of 2x?", "x^2 + C"},
	}
	for _, f := range flashcards {
		if _, err := db.ExecContext(ctx, `INSERT INTO flashcards (id, course_id, front, back, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			util.NewID(), courseID, f[0], f[1], now, now); err != nil {
			return err
		}
	}

	if _, err := db.ExecContext(ctx, `INSERT INTO enrollments (id, student_id, course_id, enrolled_at) VALUES (?, ?, ?, ?)`,
		util.NewID(), userID["STUDENT"], courseID, now); err != nil {
		return err
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO quiz_attempts (id, quiz_id, student_id, score, completed_at) VALUES (?, ?, ?, ?, ?)`,
		util.NewID(), quizID, userID["STUDENT"], 2, now); err != nil {
		return err
	}
	return nil
}
