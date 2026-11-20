package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"optimolms/backend/internal/auth"
	"optimolms/backend/internal/util"
)

// module key -> human name
var seedModules = map[string]string{
	"dashboard":    "Dashboard",
	"timetable":    "Timetable",
	"users":        "User management",
	"campuses":     "Campuses, stories & classes",
	"academic":     "Academic structure",
	"school-years": "School years",
	"subjects":     "Subjects",
	"lectures":     "Lectures",
	"assignments":  "Assignments",
	"grades":       "Grades & gradebook",
	"forums":       "Course forums",
	"records":      "Study record",
	"quizzes":      "Quizzes",
	"flashcards":   "Flashcards",
	"students":     "Students & enrollments",
	"settings":     "Settings",
	"assistant":    "AI assistant",
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
	"academic": {
		{"academic.view", "View academic structure", "See faculties, departments, programmes and their students"},
		{"academic.manage", "Manage academic structure", "Add, edit and remove faculties, departments and programmes, and admit students"},
	},
	"school-years": {
		{"school-years.view", "View school years", "See the academic years and which one is current"},
		{"school-years.manage", "Manage school years", "Create, edit, activate and remove school years"},
	},
	"subjects": {
		{"subjects.view", "View subjects", "See subjects and their lecturers"},
		{"subjects.manage", "Manage subjects", "Create, edit and remove subjects"},
	},
	"lectures": {
		{"lectures.view", "View lectures", "See lectures and their rooms"},
		{"lectures.manage", "Manage lectures", "Create, schedule, edit and remove lectures"},
	},
	"assignments": {
		{"assignments.view", "View assignments", "See assignments, due dates and own submissions"},
		{"assignments.manage", "Manage assignments", "Create, schedule, edit and remove assignments"},
		{"assignments.submit", "Submit assignments", "Hand in work and see the grade and feedback"},
		{"assignments.grade", "Grade assignments", "Score submissions and leave feedback"},
	},
	"grades": {
		{"grades.view", "View grades", "See the weighted grade breakdown of a subject"},
		{"grades.manage", "Manage gradebook", "Define grade components, weights and student points"},
		{"grades.override", "Set official results", "Override a grade with the official exam-office value"},
	},
	"forums": {
		{"forums.view", "View forums", "Read course forum threads and replies"},
		{"forums.post", "Post in forums", "Reply to a course forum thread"},
		{"forums.moderate", "Moderate forums", "Start topics, pin and lock threads"},
	},
	"records": {
		{"records.view", "View study record", "See the study card, credits and GPA"},
		{"records.manage", "Manage study record", "Record official results and past semesters"},
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
	"assistant": {
		{"assistant.use", "Use the AI assistant", "Chat with the assistant, in the floating panel and on /chat"},
		{"assistant.configure", "Manage assistant providers", "Add, edit and remove the assistant's AI providers and models"},
	},
}

// role -> permission keys granted at seed time ("*" = every permission)
var seedRoleGrants = map[string][]string{
	"ADMIN": {"*"},
	"LECTURER": {
		"dashboard.view",
		"subjects.view", "subjects.manage",
		"lectures.view", "lectures.manage",
		"assignments.view", "assignments.manage", "assignments.grade",
		"quizzes.view", "quizzes.manage",
		"flashcards.view", "flashcards.manage",
		"students.view",
		"grades.view", "grades.manage",
		"forums.view", "forums.post", "forums.moderate",
		"records.view",
		"academic.view",
		"assistant.use", "assistant.configure",
	},
	"STUDENT": {
		"dashboard.view",
		// Students read subject metadata (name, code, lecturer) to reach the
		// weeks, lectures and grades of the subjects they are enrolled in. This
		// is the read permission the API checks; the subjects *module* below is
		// what puts the page in their sidebar, and it stays read-only because
		// subjects.manage is not granted.
		"subjects.view",
		"lectures.view",
		"assignments.view", "assignments.submit",
		"quizzes.view", "quizzes.take",
		"flashcards.view",
		"grades.view",
		"forums.view", "forums.post",
		"records.view",
		"assistant.use",
	},
}

// role -> module keys the role can access (ADMIN is additionally a wildcard in code)
var seedRoleModules = map[string][]string{
	"ADMIN":    {"dashboard", "timetable", "users", "campuses", "academic", "school-years", "subjects", "lectures", "assignments", "quizzes", "flashcards", "students", "grades", "forums", "records", "settings", "assistant"},
	"LECTURER": {"dashboard", "timetable", "academic", "subjects", "lectures", "assignments", "quizzes", "flashcards", "students", "grades", "forums", "records", "assistant"},
	// Students get Subjects read-only: the module opens the list and the subject
	// page, and subjects.view (below) is the permission both the route policy and
	// the page's own gate ask for. Every write lives behind a *.manage key the
	// role does not hold.
	"STUDENT": {"dashboard", "timetable", "subjects", "lectures", "assignments", "quizzes", "flashcards", "grades", "forums", "records", "assistant"},
}

type seedUser struct {
	email    string
	password string
	name     string
	role     string
}

var seedUsers = []seedUser{
	{"admin@optimolms.dev", "admin123", "Admin User", "ADMIN"},
	{"lecturer@optimolms.dev", "lecturer123", "Lecturer User", "LECTURER"},
	{"student@optimolms.dev", "student123", "Student User", "STUDENT"},
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

	// Ids of the demo users created by this run: the demo MCP connections are
	// seeded for them once, so a revoke is never undone by the next boot.
	createdUserIDs := map[string]string{}
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
		id := util.NewID()
		if _, err := db.ExecContext(ctx, `INSERT INTO users (id, email, password_hash, name, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, u.email, string(hash), u.name, roleID[u.role], now, now); err != nil {
			return fmt.Errorf("seed user %s: %w", u.email, err)
		}
		createdUserIDs[u.email] = id
	}

	if err := seedSchoolYears(ctx, db); err != nil {
		return err
	}
	if err := seedSample(ctx, db, roleID); err != nil {
		return err
	}
	// Every floor of every campus carries rooms: a database seeded before the
	// campus data was filled in gains its missing classes here, and reruns add
	// nothing.
	if err := seedCampusRooms(ctx, db); err != nil {
		return err
	}
	// The structure is seeded after the sample courses so the demo subjects can
	// be attached to the programme that teaches them.
	if err := seedAcademicStructure(ctx, db); err != nil {
		return err
	}
	if err := seedPeople(ctx, db, roleID); err != nil {
		return err
	}
	// Every student ends up in a programme, including those the demo population
	// created and any left unplaced by an older database.
	if err := seedAdmissions(ctx, db); err != nil {
		return err
	}
	// Subjects are read week by week, so the demo content is laid out that way.
	if err := seedCourseWeeks(ctx, db); err != nil {
		return err
	}
	if err := seedNotifications(ctx, db); err != nil {
		return err
	}
	if err := seedMcpApps(ctx, db, createdUserIDs); err != nil {
		return err
	}
	return nil
}

// MCP app the assistant can act through, as the catalog stores it.
type seedMcpApp struct {
	key         string
	name        string
	description string
	category    string
	glyph       string
	tone        string
	scopes      []string
}

// The shared catalog. `glyph` is the mark the profile draws inside the app's
// avatar and `tone` picks the HIG system colour behind it.
var seedMcpAppsCatalog = []seedMcpApp{
	{"github", "GitHub", "Repositories, issues and pull requests for coursework and projects.", "Development", "GH", "gray", []string{"repo:read", "issues:write"}},
	{"google-drive", "Google Drive", "Course materials, lecture slides and shared folders.", "Files", "GD", "blue", []string{"drive.file", "drive.metadata.readonly"}},
	{"google-calendar", "Google Calendar", "Deadlines, exam dates and office hours in the assistant's answers.", "Schedule", "GC", "red", []string{"calendar.events"}},
	{"notion", "Notion", "Lecture notes and study pages the assistant can read and extend.", "Notes", "NO", "teal", []string{"read_content", "insert_content"}},
	{"slack", "Slack", "Course channels and direct messages with lecturers.", "Messages", "SL", "indigo", []string{"channels:read", "chat:write"}},
	{"figma", "Figma", "Design files for project work and reviews.", "Design", "FG", "orange", []string{"file_content:read"}},
	{"postgres", "Postgres", "The read-only gradebook replica the assistant can query.", "Data", "PG", "green", []string{"select"}},
}

// A connection as seeded: how long ago it was made, and whether it was used.
type seedMcpConnection struct {
	key     string
	daysAgo int
	used    bool
}

var seedMcpConnections = map[string][]seedMcpConnection{
	"admin@optimolms.dev": {
		{"github", 2, true},
		{"google-drive", 9, true},
		{"slack", 21, false},
	},
	"lecturer@optimolms.dev": {
		{"google-drive", 4, true},
		{"notion", 12, true},
		{"google-calendar", 30, true},
	},
	"student@optimolms.dev": {
		{"github", 6, true},
		{"notion", 15, false},
	},
}

// seedMcpApps keeps the app catalog current and gives brand-new demo users a
// few connections, so the profile's Security section has real rows to draw as
// avatars. The catalog is reference data and is refreshed on every boot; the
// connections are demo data and are written only for the users created by this
// run, so disconnecting an app is never undone by a restart.
func seedMcpApps(ctx context.Context, db *sql.DB, createdUserIDs map[string]string) error {
	for _, app := range seedMcpAppsCatalog {
		if _, err := db.ExecContext(ctx, `
			INSERT INTO mcp_apps (key, name, description, category, glyph, tone, scopes, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(key) DO UPDATE SET
				name = excluded.name,
				description = excluded.description,
				category = excluded.category,
				glyph = excluded.glyph,
				tone = excluded.tone,
				scopes = excluded.scopes`,
			app.key, app.name, app.description, app.category, app.glyph, app.tone,
			mustJSON(app.scopes), util.Now()); err != nil {
			return fmt.Errorf("seed mcp app %s: %w", app.key, err)
		}
	}

	now := time.Now().UTC()
	for email, connections := range seedMcpConnections {
		userID, isNew := createdUserIDs[email]
		if !isNew {
			continue
		}
		for _, connection := range connections {
			connectedAt := now.AddDate(0, 0, -connection.daysAgo).Format(time.RFC3339)
			var lastUsedAt any // NULL until the assistant calls the app
			if connection.used {
				lastUsedAt = now.
					AddDate(0, 0, -connection.daysAgo).
					Add(2 * time.Hour).
					Format(time.RFC3339)
			}
			if _, err := db.ExecContext(ctx, `
				INSERT OR IGNORE INTO user_mcp_apps (user_id, app_key, connected_at, last_used_at)
				VALUES (?, ?, ?, ?)`,
				userID, connection.key, connectedAt, lastUsedAt); err != nil {
				return fmt.Errorf("seed mcp connection %s->%s: %w", email, connection.key, err)
			}
		}
	}
	return nil
}

// seedNotifications gives every demo user a small, idempotent notification feed.
func seedNotifications(ctx context.Context, db *sql.DB) error {
	feeds := map[string][][2]string{
		"ADMIN": {
			{"Welcome to OptimoLMS", "You have full access to every module and permission."},
			{"Campus ready", "Main Campus and its rooms are ready for scheduling."},
		},
		"LECTURER": {
			{"Course assigned", "You teach Mathematics I this term."},
			{"Student enrolled", "Student User enrolled in Mathematics I."},
		},
		"STUDENT": {
			{"Welcome to OptimoLMS", "Your Mathematics I enrollment is active."},
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

// seedSchoolYears puts the academic calendar in place: the year that just
// ended and the one running now. Subjects are scheduled into the current one.
// Idempotent: a year that already exists is left untouched.
func seedSchoolYears(ctx context.Context, db *sql.DB) error {
	years := []struct {
		name     string
		startsOn string
		endsOn   string
	}{
		{"2025/2026", "2025-09-01", "2026-06-30"},
		{"2026/2027", "2026-09-01", "2027-06-30"},
	}
	for _, year := range years {
		var existing string
		err := db.QueryRowContext(ctx, `SELECT id FROM school_years WHERE name = ?`, year.name).Scan(&existing)
		if err == nil {
			continue
		}
		if err != sql.ErrNoRows {
			return fmt.Errorf("lookup school year %s: %w", year.name, err)
		}
		now := util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO school_years (id, name, starts_on, ends_on, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, 0, ?, ?)`,
			util.NewID(), year.name, year.startsOn, year.endsOn, now, now); err != nil {
			return fmt.Errorf("seed school year %s: %w", year.name, err)
		}
	}

	// The current year, only when the calendar has none: a year an admin put in
	// place is never overridden by a later boot.
	if _, err := db.ExecContext(ctx, `
		UPDATE school_years SET is_active = 1, updated_at = ?
		WHERE name = '2026/2027'
		  AND NOT EXISTS (SELECT 1 FROM school_years WHERE is_active = 1)`, util.Now()); err != nil {
		return fmt.Errorf("seed active school year: %w", err)
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

// The rooms every floor is seeded with, ground floor first: a lecture hall for
// the big cohorts, a seminar room, a computer lab and somewhere small to study.
// The name of a room is built from its floor, so floor 2 gets "B201".."B205".
var seedFloorRooms = []struct {
	suffix   string
	capacity int
	tags     []string
}{
	{"01", 80, []string{"lecture hall", "projector"}},
	{"02", 45, []string{"lecture hall", "whiteboard"}},
	{"03", 30, []string{"seminar", "whiteboard"}},
	{"04", 24, []string{"computers", "lab"}},
	{"05", 18, []string{"study room"}},
}

// seedRoomName builds the name a room is shown under: the floor's letter and
// number followed by the room's place on that floor ("B201" on floor 2).
func seedRoomName(floor int, suffix string) string {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	index := floor - 1
	if index < 0 {
		index = 0
	}
	if index >= len(letters) {
		index = len(letters) - 1
	}
	return fmt.Sprintf("%c%d%s", letters[index], floor, suffix)
}

// seedCampusRooms gives every floor of every campus the block of rooms above.
// It writes only the rooms a floor is missing, so a database that has been in
// use for a while fills up on the next boot, rooms an administrator added or
// edited keep their place, and a second boot changes nothing.
func seedCampusRooms(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `SELECT id, floor_number FROM stories ORDER BY campus_id, floor_number`)
	if err != nil {
		return fmt.Errorf("seed campus rooms: %w", err)
	}
	defer rows.Close()
	type floor struct {
		id    string
		level int
	}
	var floors []floor
	for rows.Next() {
		var f floor
		if err := rows.Scan(&f.id, &f.level); err != nil {
			return fmt.Errorf("seed campus rooms: %w", err)
		}
		floors = append(floors, f)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("seed campus rooms: %w", err)
	}

	now := util.Now()
	for _, f := range floors {
		for _, room := range seedFloorRooms {
			name := seedRoomName(f.level, room.suffix)
			if _, err := db.ExecContext(ctx, `
				INSERT OR IGNORE INTO classes (id, story_id, name, capacity, tags, created_at, updated_at)
				SELECT ?, ?, ?, ?, ?, ?, ?
				WHERE NOT EXISTS (SELECT 1 FROM classes WHERE story_id = ? AND name = ?)`,
				util.NewID(), f.id, name, room.capacity, mustJSON(room.tags), now, now, f.id, name); err != nil {
				return fmt.Errorf("seed room %s: %w", name, err)
			}
		}
	}
	return nil
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
		{3, "Second floor", []struct {
			name     string
			capacity int
			tags     []string
		}{
			{"C301", 120, []string{"lecture hall", "projector"}},
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
	if _, err := db.ExecContext(ctx, `INSERT INTO subjects (id, name, code, description, lecturer_id, ects, semester, school_year, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		subjectID, "Mathematics I", "MATH101", "Limits, derivatives and integrals.", userID["LECTURER"], 6, "FIRST", "2026/2027", now, now); err != nil {
		return err
	}

	physicsID := util.NewID()
	if _, err := db.ExecContext(ctx, `INSERT INTO subjects (id, name, code, description, lecturer_id, ects, semester, school_year, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		physicsID, "Physics I", "PHYS101", "Mechanics and thermodynamics.", userID["LECTURER"], 5, "FIRST", "2026/2027", now, now); err != nil {
		return err
	}

	if _, err := db.ExecContext(ctx, `INSERT INTO lectures (id, subject_id, class_id, title, description, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		util.NewID(), subjectID, classIDs["B201"], "Introduction to limits", "Epsilon-delta intuition.", "2026-11-23T09:00:00Z", now, now); err != nil {
		return err
	}
	assignmentDefs := []struct {
		id, subjectID, classID, title, description, scheduledAt, dueAt string
		maxPoints                                                      int
		submissionType                                                 string
	}{
		{util.NewID(), subjectID, classIDs["A102"], "Derivative exercises",
			"Worksheet on the chain rule.", "2026-11-24T11:00:00Z", "2026-12-05T23:59:00Z", 100, "both"},
		{util.NewID(), subjectID, classIDs["A102"], "Limits problem set",
			"Ten limits to compute analytically.", "2026-12-01T11:00:00Z", "2026-12-15T23:59:00Z", 50, "file"},
		{util.NewID(), physicsID, classIDs["A101"], "Free body diagrams",
			"Draw and justify the forces for five systems.", "2026-12-02T09:00:00Z", "2026-12-12T23:59:00Z", 100, "file"},
	}
	for _, a := range assignmentDefs {
		if _, err := db.ExecContext(ctx, `
			INSERT INTO assignments (id, subject_id, class_id, title, description, scheduled_at, due_at,
			                         max_points, allow_late, submission_type, is_published, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?)`,
			a.id, a.subjectID, a.classID, a.title, a.description, a.scheduledAt, a.dueAt,
			a.maxPoints, a.submissionType, now, now); err != nil {
			return err
		}
	}

	quizID := util.NewID()
	if _, err := db.ExecContext(ctx, `INSERT INTO quizzes (id, subject_id, title, description, time_limit_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		quizID, subjectID, "Limits basics", "Short quiz on limits.", 10, now, now); err != nil {
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

	flashcardSetID := util.NewID()
	if _, err := db.ExecContext(ctx, `INSERT INTO flashcard_sets (id, subject_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		flashcardSetID, subjectID, "Derivatives and integrals", "The basic rules, front to back.", now, now); err != nil {
		return err
	}
	flashcards := [][2]string{
		{"What is the derivative of x^2?", "2x"},
		{"What is the integral of 2x?", "x^2 + C"},
	}
	for position, f := range flashcards {
		if _, err := db.ExecContext(ctx, `INSERT INTO flashcards (id, subject_id, set_id, position, front, back, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			util.NewID(), subjectID, flashcardSetID, position, f[0], f[1], now, now); err != nil {
			return err
		}
	}

	for _, enrolledSubject := range []string{subjectID, physicsID} {
		if _, err := db.ExecContext(ctx, `INSERT INTO enrollments (id, student_id, subject_id, enrolled_at) VALUES (?, ?, ?, ?)`,
			util.NewID(), userID["STUDENT"], enrolledSubject, now); err != nil {
			return err
		}
	}

	// gradebook: midterm 40% (graded), final 50% and engagement 10% still open
	components := []struct {
		name, kind string
		weight     float64
		points     *float64
	}{
		{"Midterm exam", "midterm", 40, floatPtr(82)},
		{"Final exam", "final", 50, nil},
		{"Engagement", "engagement", 10, floatPtr(90)},
	}
	for i, component := range components {
		componentID := util.NewID()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO grade_components (id, subject_id, name, type, weight_percent, max_points,
			                              order_index, is_published, created_by, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 100, ?, 1, ?, ?, ?)`,
			componentID, subjectID, component.name, component.kind, component.weight, i,
			userID["LECTURER"], now, now); err != nil {
			return err
		}
		if component.points != nil {
			if _, err := db.ExecContext(ctx, `
				INSERT INTO grade_entries (id, component_id, student_id, points, graded_by, graded_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				util.NewID(), componentID, userID["STUDENT"], *component.points, userID["LECTURER"], now, now, now); err != nil {
				return err
			}
		}
	}

	// a course forum with one topic and one reply
	forumID := util.NewID()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO forums (id, subject_id, title, description, is_locked, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
		forumID, subjectID, "Course questions", "Ask about the lectures and the problem sets.",
		userID["LECTURER"], now, now); err != nil {
		return err
	}
	threadID := util.NewID()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO forum_threads (id, forum_id, title, body, author_id, is_pinned, is_locked, last_post_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
		threadID, forumID, "How is the exam graded?", "The exam is 40% of the total; the rest is the final and engagement.",
		userID["LECTURER"], now, now, now); err != nil {
		return err
	}
	if _, err := db.ExecContext(ctx, `
		INSERT INTO forum_posts (id, thread_id, author_id, body, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		util.NewID(), threadID, userID["STUDENT"], "Thanks, is the engagement mark based on attendance?", now, now); err != nil {
		return err
	}
	if _, err := db.ExecContext(ctx, `
		INSERT INTO quiz_attempts (id, quiz_id, student_id, score, started_at, expires_at, status, completed_at)
		VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
		util.NewID(), quizID, userID["STUDENT"], 2, now, now, now); err != nil {
		return err
	}
	return nil
}

func floatPtr(v float64) *float64 { return &v }
