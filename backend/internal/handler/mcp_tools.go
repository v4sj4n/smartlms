package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"smartlms/backend/internal/util"
)

/*
The SmartLMS MCP server: the backend's own content actions, offered to the
assistant as MCP tools.

One registry, three consumers — the JSON-RPC endpoint (POST /api/mcp), the chat
tool loop in ai_chat.go and the MCP tab's catalogue (GET /api/mcp/tools) — so a
tool can only ever mean one thing. Every tool carries the permission its HTTP
twin requires, runs as the person who is signed in, and writes through the same
tables the screens write through: the assistant creates subjects, weeks,
lectures, assignments, quizzes, flashcards and forum threads exactly as a click
would, never behind the user's back.
*/

const mcpServerKey = "smartlms"

// mcpTool is one callable action. InputSchema is JSON Schema, which is both what
// MCP clients advertise and what the OpenAI tool definition sends to the model.
type mcpTool struct {
	Name        string
	Title       string
	Description string
	Module      string
	Permission  string
	InputSchema map[string]any
	Run         func(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error)
}

/* ---------- JSON Schema helpers ------------------------------------------- */

func schemaProp(typ, desc string) map[string]any {
	return map[string]any{"type": typ, "description": desc}
}

func schemaObject(props map[string]any, required ...string) map[string]any {
	schema := map[string]any{"type": "object", "properties": props}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

/* ---------- argument readers ---------------------------------------------- */

// Tools are called with JSON decoded into any, so numbers arrive as float64.
func argString(args map[string]any, key string) string {
	switch value := args[key].(type) {
	case string:
		return strings.TrimSpace(value)
	case float64:
		if value == float64(int64(value)) {
			return strconv.FormatInt(int64(value), 10)
		}
		return strconv.FormatFloat(value, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(value)
	}
	return ""
}

func argInt(args map[string]any, key string) int {
	switch value := args[key].(type) {
	case float64:
		return int(value)
	case string:
		if n, err := strconv.Atoi(strings.TrimSpace(value)); err == nil {
			return n
		}
	}
	return 0
}

func argFloat(args map[string]any, key string) float64 {
	switch value := args[key].(type) {
	case float64:
		return value
	case string:
		if f, err := strconv.ParseFloat(strings.TrimSpace(value), 64); err == nil {
			return f
		}
	}
	return 0
}

// argBool keeps the difference between "absent" and "false" so a tool can use
// the column's default instead of forcing false.
func argBool(args map[string]any, key string) (bool, bool) {
	switch value := args[key].(type) {
	case bool:
		return value, true
	case string:
		parsed, err := strconv.ParseBool(strings.TrimSpace(value))
		return parsed, err == nil
	}
	return false, false
}

func argStrings(args map[string]any, key string) []string {
	out := []string{}
	items, ok := args[key].([]any)
	if !ok {
		return out
	}
	for _, item := range items {
		if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
			out = append(out, strings.TrimSpace(text))
		}
	}
	return out
}

func argObjects(args map[string]any, key string) []map[string]any {
	out := []map[string]any{}
	items, ok := args[key].([]any)
	if !ok {
		return out
	}
	for _, item := range items {
		if object, ok := item.(map[string]any); ok {
			out = append(out, object)
		}
	}
	return out
}

/* ---------- the catalogue -------------------------------------------------- */

func mcpTools() []mcpTool {
	subjectID := schemaProp("string", "Subject id, from list_subjects")
	weekID := schemaProp("string", "Optional course week id, from list_weeks")

	return append([]mcpTool{
		{
			Name: "list_subjects", Title: "List subjects", Module: "subjects",
			Permission: "subjects.view",
			Description: "List the subjects the school teaches, with how much content each one holds. " +
				"Call this first: every other tool takes a subject_id.",
			InputSchema: schemaObject(map[string]any{
				"school_year": schemaProp("string", "Optional school year, e.g. 2026/2027"),
			}),
			Run: runListSubjects,
		},
		{
			Name: "create_subject", Title: "Create subject", Module: "subjects",
			Permission:  "subjects.manage",
			Description: "Create a subject (a course). You become its lecturer unless another lecturer_id is given.",
			InputSchema: schemaObject(map[string]any{
				"name":        schemaProp("string", "Subject name, e.g. Algorithms and Data Structures"),
				"code":        schemaProp("string", "Optional short code, unique across the school"),
				"description": schemaProp("string", "Optional one-paragraph description"),
				"ects":        schemaProp("number", "Optional ECTS credits, e.g. 6"),
				"semester":    schemaProp("string", "FIRST or SECOND"),
				"school_year": schemaProp("string", "Optional school year, e.g. 2026/2027"),
				"lecturer_id": schemaProp("string", "Optional lecturer user id; defaults to you"),
			}, "name"),
			Run: runCreateSubject,
		},
		{
			Name: "list_weeks", Title: "List course weeks", Module: "subjects",
			Permission:  "subjects.view",
			Description: "List the weeks a subject is taught in, so content can be filed under the right week.",
			InputSchema: schemaObject(map[string]any{"subject_id": subjectID}, "subject_id"),
			Run:         onReadableSubject(subjectFromArg, runListWeeks),
		},
		{
			Name: "create_week", Title: "Create course week", Module: "subjects",
			Permission: "subjects.manage",
			Description: "Add the next week to a subject. Leave week_number empty to append, and the dates " +
				"empty unless the week is already scheduled.",
			InputSchema: schemaObject(map[string]any{
				"subject_id":  subjectID,
				"week_number": schemaProp("integer", "1-30; empty appends the next number"),
				"season":      schemaProp("string", "FALL or SUMMER; defaults to the subject's semester"),
				"title":       schemaProp("string", "Optional week title"),
				"description": schemaProp("string", "Optional what the week covers"),
				"starts_on":   schemaProp("string", "Optional Monday, YYYY-MM-DD"),
				"ends_on":     schemaProp("string", "Optional Sunday, YYYY-MM-DD"),
			}, "subject_id"),
			Run: onOwnSubject(subjectFromArg, runCreateWeek),
		},
		{
			Name: "create_lecture", Title: "Create lecture", Module: "lectures",
			Permission:  "lectures.manage",
			Description: "Add a lecture to a subject, optionally scheduled and filed under a course week.",
			InputSchema: schemaObject(map[string]any{
				"subject_id":   subjectID,
				"title":        schemaProp("string", "Lecture title"),
				"description":  schemaProp("string", "Optional outline of the lecture"),
				"scheduled_at": schemaProp("string", "Optional ISO date-time, e.g. 2026-11-20T10:00:00Z"),
				"week_id":      weekID,
			}, "subject_id", "title"),
			Run: onOwnSubject(subjectFromArg, runCreateLecture),
		},
		{
			Name: "create_assignment", Title: "Create assignment", Module: "assignments",
			Permission: "assignments.manage",
			Description: "Add an assignment to a subject with its due date, points and submission type. " +
				"It is published to students straight away.",
			InputSchema: schemaObject(map[string]any{
				"subject_id":      subjectID,
				"title":           schemaProp("string", "Assignment title"),
				"description":     schemaProp("string", "Optional instructions for students"),
				"due_at":          schemaProp("string", "Optional ISO date-time the work is due"),
				"max_points":      schemaProp("integer", "Maximum points, 100 when empty"),
				"allow_late":      schemaProp("boolean", "Whether late work is accepted"),
				"submission_type": schemaProp("string", "text, file or both"),
				"week_id":         weekID,
			}, "subject_id", "title"),
			Run: onOwnSubject(subjectFromArg, runCreateAssignment),
		},
		{
			Name: "create_quiz", Title: "Create quiz", Module: "quizzes",
			Permission:  "quizzes.manage",
			Description: "Create a quiz shell in a subject; add questions with add_quiz_question.",
			InputSchema: schemaObject(map[string]any{
				"subject_id":         subjectID,
				"title":              schemaProp("string", "Quiz title"),
				"description":        schemaProp("string", "Optional description"),
				"time_limit_minutes": schemaProp("integer", "Optional time limit; empty means untimed"),
				"week_id":            weekID,
			}, "subject_id", "title"),
			Run: onOwnSubject(subjectFromArg, runCreateQuiz),
		},
		{
			Name: "add_quiz_question", Title: "Add quiz question", Module: "quizzes",
			Permission: "quizzes.manage",
			Description: "Append a question to a quiz. For mcq pass the choices in options and the correct " +
				"choice in answer; for true_false use true or false; otherwise answer is the expected text.",
			InputSchema: schemaObject(map[string]any{
				"quiz_id": schemaProp("string", "Quiz id returned by create_quiz"),
				"type":    schemaProp("string", "mcq, true_false or short_answer"),
				"prompt":  schemaProp("string", "The question"),
				"options": map[string]any{
					"type":        "array",
					"description": "The choices, for mcq",
					"items":       map[string]any{"type": "string"},
				},
				"answer": schemaProp("string", "The correct option or expected answer"),
				"points": schemaProp("integer", "Points for a correct answer, 1 when empty"),
			}, "quiz_id", "prompt", "answer"),
			Run: onOwnSubject(subjectFromQuiz, runAddQuizQuestion),
		},
		{
			Name: "create_flashcards", Title: "Create flashcards", Module: "flashcards",
			Permission:  "flashcards.manage",
			Description: "Add one or more flashcards to a subject in a single call, optionally filed under a week.",
			InputSchema: schemaObject(map[string]any{
				"subject_id": subjectID,
				"week_id":    weekID,
				"cards": map[string]any{
					"type": "array",
					"items": schemaObject(map[string]any{
						"front": schemaProp("string", "The prompt side"),
						"back":  schemaProp("string", "The answer side"),
					}, "front", "back"),
				},
			}, "subject_id", "cards"),
			Run: onOwnSubject(subjectFromArg, runCreateFlashcards),
		},
		{
			Name: "create_forum_thread", Title: "Start a forum thread", Module: "forums",
			Permission: "forums.moderate",
			Description: "Start a topic in a subject's course forum, creating the forum first when the " +
				"subject has none yet.",
			InputSchema: schemaObject(map[string]any{
				"subject_id": subjectID,
				"title":      schemaProp("string", "Thread title"),
				"body":       schemaProp("string", "The opening post"),
			}, "subject_id", "title", "body"),
			Run: runCreateForumThread,
		},
		{
			Name: "post_forum_reply", Title: "Reply in a forum", Module: "forums",
			Permission:  "forums.post",
			Description: "Reply to an existing forum thread as the signed-in user.",
			InputSchema: schemaObject(map[string]any{
				"thread_id": schemaProp("string", "Thread id"),
				"body":      schemaProp("string", "The reply"),
			}, "thread_id", "body"),
			Run: onReadableSubject(subjectFromThread, runPostForumReply),
		},
	}, roleMCPTools()...)
}

func findMCPTool(name string) (mcpTool, bool) {
	for _, tool := range mcpTools() {
		if tool.Name == name {
			return tool, true
		}
	}
	return mcpTool{}, false
}

// visibleMCPTools keeps the tools the caller's permissions cover: what a person
// cannot do on a screen, the assistant cannot do for them either.
func visibleMCPTools(scope accessScope) []mcpTool {
	allowed := make(map[string]struct{}, len(scope.Permissions))
	for _, key := range scope.Permissions {
		allowed[key] = struct{}{}
	}
	out := make([]mcpTool, 0, len(mcpTools()))
	for _, tool := range mcpTools() {
		if _, ok := allowed[tool.Permission]; ok {
			out = append(out, tool)
		}
	}
	return out
}

/* ---------- tool bodies ---------------------------------------------------- */

func runListSubjects(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	where, params := "", []any{}
	if year := argString(args, "school_year"); year != "" {
		where = ` WHERE COALESCE(s.school_year, '') = ?`
		params = append(params, year)
	}
	rows, err := db.QueryContext(ctx, `
		SELECT s.id, s.name, COALESCE(s.code, ''), COALESCE(s.school_year, ''), s.semester,
		       (SELECT COUNT(*) FROM course_weeks w WHERE w.subject_id = s.id),
		       (SELECT COUNT(*) FROM lectures    x WHERE x.subject_id = s.id),
		       (SELECT COUNT(*) FROM assignments a WHERE a.subject_id = s.id),
		       (SELECT COUNT(*) FROM quizzes     q WHERE q.subject_id = s.id),
		       (SELECT COUNT(*) FROM flashcards  f WHERE f.subject_id = s.id)
		FROM subjects s`+where+` ORDER BY s.name LIMIT 100`, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	subjects := []map[string]any{}
	for rows.Next() {
		var (
			id, name, code, year, semester string
			weeks, lectures, assignments   int
			quizzes, flashcards            int
		)
		if err := rows.Scan(&id, &name, &code, &year, &semester,
			&weeks, &lectures, &assignments, &quizzes, &flashcards); err != nil {
			return nil, err
		}
		subjects = append(subjects, map[string]any{
			"id": id, "name": name, "code": code, "school_year": year, "semester": semester,
			"weeks": weeks, "lectures": lectures, "assignments": assignments,
			"quizzes": quizzes, "flashcards": flashcards,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return map[string]any{"subjects": subjects, "count": len(subjects)}, nil
}

func runCreateSubject(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	name := argString(args, "name")
	if name == "" {
		return nil, errors.New("name is required")
	}

	lecturerID := argString(args, "lecturer_id")
	if lecturerID == "" {
		lecturerID = userID
	} else if !rowExists(ctx, db, "users", lecturerID) {
		return nil, fmt.Errorf("unknown lecturer %q; omit lecturer_id to own the subject yourself", lecturerID)
	}

	semester := strings.ToUpper(argString(args, "semester"))
	if semester != "SECOND" {
		semester = "FIRST"
	}
	schoolYear, err := resolveSchoolYear(ctx, db, argString(args, "school_year"))
	if err != nil {
		if errors.Is(err, errUnknownSchoolYear) {
			return nil, errors.New("unknown school year; list or create one under School years first")
		}
		return nil, err
	}

	var ects any
	if value := argFloat(args, "ects"); value > 0 {
		ects = value
	}

	id, now := util.NewID(), util.Now()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO subjects (id, name, code, description, lecturer_id, ects, semester, school_year,
		                      created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, name, nullIfEmpty(argString(args, "code")), argString(args, "description"),
		nullIfEmpty(lecturerID), ects, semester, nullIfEmpty(schoolYear), now, now); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, fmt.Errorf("a subject with code %q already exists", argString(args, "code"))
		}
		return nil, err
	}

	return map[string]any{
		"id": id, "name": name, "code": argString(args, "code"),
		"semester": semester, "school_year": schoolYear, "lecturer_id": lecturerID,
		"message": "subject created",
	}, nil
}

func runListWeeks(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	subjectID := argString(args, "subject_id")
	if subjectID == "" {
		return nil, errors.New("subject_id is required; call list_subjects to find one")
	}
	rows, err := db.QueryContext(ctx, `
		SELECT id, week_number, season, COALESCE(school_year, ''), COALESCE(title, ''),
		       COALESCE(starts_on, ''), COALESCE(ends_on, ''),
		       (SELECT COUNT(*) FROM lectures    l WHERE l.week_id = w.id),
		       (SELECT COUNT(*) FROM assignments a WHERE a.week_id = w.id),
		       (SELECT COUNT(*) FROM quizzes     q WHERE q.week_id = w.id),
		       (SELECT COUNT(*) FROM flashcards  f WHERE f.week_id = w.id)
		FROM course_weeks w WHERE subject_id = ? ORDER BY week_number LIMIT 60`, subjectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	weeks := []map[string]any{}
	for rows.Next() {
		var (
			id, season, year, title, startsOn, endsOn string
			number, lectures, assignments             int
			quizzes, flashcards                       int
		)
		if err := rows.Scan(&id, &number, &season, &year, &title, &startsOn, &endsOn,
			&lectures, &assignments, &quizzes, &flashcards); err != nil {
			return nil, err
		}
		weeks = append(weeks, map[string]any{
			"id": id, "week_number": number, "season": season, "school_year": year,
			"title": title, "starts_on": startsOn, "ends_on": endsOn,
			"lectures": lectures, "assignments": assignments,
			"quizzes": quizzes, "flashcards": flashcards,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return map[string]any{"subject_id": subjectID, "weeks": weeks, "count": len(weeks)}, nil
}

func runCreateWeek(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	subjectID := argString(args, "subject_id")
	if subjectID == "" {
		return nil, errors.New("subject_id is required; call list_subjects to find one")
	}

	var semester string
	var subjectYear sql.NullString
	err := db.QueryRowContext(ctx,
		`SELECT semester, school_year FROM subjects WHERE id = ?`, subjectID).Scan(&semester, &subjectYear)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("unknown subject %q", subjectID)
	}
	if err != nil {
		return nil, err
	}

	season, ok := normaliseSeason(argString(args, "season"), semester)
	if !ok {
		return nil, errors.New("season must be FALL or SUMMER")
	}

	schoolYear := argString(args, "school_year")
	if schoolYear == "" {
		schoolYear = subjectYear.String
	}
	resolvedYear, err := resolveSchoolYear(ctx, db, schoolYear)
	if err != nil {
		if errors.Is(err, errUnknownSchoolYear) {
			return nil, errors.New("unknown school year; list or create one under School years first")
		}
		return nil, err
	}

	number := argInt(args, "week_number")
	if number == 0 {
		number, err = nextWeekNumber(ctx, db, subjectID, resolvedYear, season)
		if err != nil {
			return nil, err
		}
	}
	if number < 1 || number > 30 {
		return nil, errors.New("a week number runs from 1 to 30")
	}

	free, err := weekNumberFree(ctx, db, subjectID, resolvedYear, season, number, "")
	if err != nil {
		return nil, err
	}
	if !free {
		return nil, fmt.Errorf("week %d already exists in this season", number)
	}

	startsOn, endsOn, problem := normaliseWeekDates(argString(args, "starts_on"), argString(args, "ends_on"))
	if problem != "" {
		return nil, errors.New(problem)
	}

	id, now := util.NewID(), util.Now()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO course_weeks (id, subject_id, school_year, season, week_number, title,
		                          description, starts_on, ends_on, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, subjectID, nullIfEmpty(resolvedYear), season, number,
		nullIfEmpty(argString(args, "title")), nullIfEmpty(argString(args, "description")),
		nullIfEmpty(startsOn), nullIfEmpty(endsOn), now, now); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, fmt.Errorf("week %d already exists in this season", number)
		}
		return nil, err
	}

	return map[string]any{
		"id": id, "subject_id": subjectID, "week_number": number, "season": season,
		"school_year": resolvedYear, "title": argString(args, "title"),
		"starts_on": startsOn, "ends_on": endsOn, "message": "week created",
	}, nil
}

func runCreateLecture(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	subjectID := argString(args, "subject_id")
	title := argString(args, "title")
	switch {
	case subjectID == "":
		return nil, errors.New("subject_id is required; call list_subjects to find one")
	case title == "":
		return nil, errors.New("title is required")
	case !rowExists(ctx, db, "subjects", subjectID):
		return nil, fmt.Errorf("unknown subject %q", subjectID)
	}

	weekPlacementValue, problem := weekPlacement(ctx, db, subjectID, argString(args, "week_id"))
	if problem != "" {
		return nil, errors.New(problem)
	}

	id, now := util.NewID(), util.Now()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO lectures (id, subject_id, title, description, scheduled_at, week_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, subjectID, title, argString(args, "description"),
		nullIfEmpty(argString(args, "scheduled_at")), weekPlacementValue, now, now); err != nil {
		return nil, err
	}

	return map[string]any{
		"id": id, "subject_id": subjectID, "title": title,
		"scheduled_at": argString(args, "scheduled_at"), "week_id": argString(args, "week_id"),
		"message": "lecture created",
	}, nil
}

func runCreateAssignment(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	subjectID := argString(args, "subject_id")
	title := argString(args, "title")
	switch {
	case subjectID == "":
		return nil, errors.New("subject_id is required; call list_subjects to find one")
	case title == "":
		return nil, errors.New("title is required")
	case !rowExists(ctx, db, "subjects", subjectID):
		return nil, fmt.Errorf("unknown subject %q", subjectID)
	}

	maxPoints := argInt(args, "max_points")
	if maxPoints <= 0 {
		maxPoints = 100
	}
	submissionType := argString(args, "submission_type")
	if submissionType != "text" && submissionType != "file" {
		submissionType = "both"
	}
	allowLate := 1
	if late, given := argBool(args, "allow_late"); given && !late {
		allowLate = 0
	}

	weekPlacementValue, problem := weekPlacement(ctx, db, subjectID, argString(args, "week_id"))
	if problem != "" {
		return nil, errors.New(problem)
	}

	id, now := util.NewID(), util.Now()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO assignments (id, subject_id, title, description, due_at, max_points, allow_late,
		                         submission_type, is_published, week_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
		id, subjectID, title, argString(args, "description"),
		nullIfEmpty(argString(args, "due_at")), maxPoints, allowLate, submissionType,
		weekPlacementValue, now, now); err != nil {
		return nil, err
	}

	return map[string]any{
		"id": id, "subject_id": subjectID, "title": title,
		"due_at": argString(args, "due_at"), "max_points": maxPoints,
		"allow_late": allowLate == 1, "submission_type": submissionType,
		"week_id": argString(args, "week_id"), "message": "assignment created and published",
	}, nil
}

func runCreateQuiz(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	subjectID := argString(args, "subject_id")
	title := argString(args, "title")
	switch {
	case subjectID == "":
		return nil, errors.New("subject_id is required; call list_subjects to find one")
	case title == "":
		return nil, errors.New("title is required")
	case !rowExists(ctx, db, "subjects", subjectID):
		return nil, fmt.Errorf("unknown subject %q", subjectID)
	}

	weekPlacementValue, problem := weekPlacement(ctx, db, subjectID, argString(args, "week_id"))
	if problem != "" {
		return nil, errors.New(problem)
	}

	id, now := util.NewID(), util.Now()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO quizzes (id, subject_id, title, description, time_limit_minutes, week_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, subjectID, title, argString(args, "description"), argInt(args, "time_limit_minutes"),
		weekPlacementValue, now, now); err != nil {
		return nil, err
	}

	return map[string]any{
		"id": id, "subject_id": subjectID, "title": title,
		"time_limit_minutes": argInt(args, "time_limit_minutes"),
		"week_id":            argString(args, "week_id"),
		"message":            "quiz created; add questions with add_quiz_question",
	}, nil
}

func runAddQuizQuestion(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	quizID := argString(args, "quiz_id")
	prompt := argString(args, "prompt")
	answer := argString(args, "answer")
	switch {
	case quizID == "":
		return nil, errors.New("quiz_id is required; call create_quiz first")
	case prompt == "":
		return nil, errors.New("prompt is required")
	case answer == "":
		return nil, errors.New("answer is required")
	case !rowExists(ctx, db, "quizzes", quizID):
		return nil, fmt.Errorf("unknown quiz %q", quizID)
	}

	questionType := argString(args, "type")
	if questionType != "mcq" && questionType != "true_false" && questionType != "short_answer" {
		questionType = "mcq"
	}
	options := argStrings(args, "options")
	if questionType == "mcq" && len(options) < 2 {
		return nil, errors.New("an mcq needs at least two options")
	}
	if questionType == "true_false" {
		options = []string{"true", "false"}
		answer = strings.ToLower(answer)
		if answer != "true" && answer != "false" {
			return nil, errors.New("a true_false answer must be true or false")
		}
	}
	encodedOptions, err := json.Marshal(options)
	if err != nil {
		return nil, err
	}

	points := argInt(args, "points")
	if points <= 0 {
		points = 1
	}

	var orderIndex int
	if err := db.QueryRowContext(ctx,
		`SELECT COALESCE(MAX(order_index), -1) + 1 FROM quiz_questions WHERE quiz_id = ?`, quizID).
		Scan(&orderIndex); err != nil {
		return nil, err
	}

	id := util.NewID()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO quiz_questions (id, quiz_id, type, prompt, options, answer, points, order_index)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, quizID, questionType, prompt, string(encodedOptions), answer, points, orderIndex); err != nil {
		return nil, err
	}

	return map[string]any{
		"id": id, "quiz_id": quizID, "type": questionType, "prompt": prompt,
		"points": points, "order_index": orderIndex, "message": "question added",
	}, nil
}

func runCreateFlashcards(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	subjectID := argString(args, "subject_id")
	if subjectID == "" {
		return nil, errors.New("subject_id is required; call list_subjects to find one")
	}
	if !rowExists(ctx, db, "subjects", subjectID) {
		return nil, fmt.Errorf("unknown subject %q", subjectID)
	}
	cards := argObjects(args, "cards")
	if len(cards) == 0 {
		return nil, errors.New("cards is required: pass at least one {front, back}")
	}

	weekPlacementValue, problem := weekPlacement(ctx, db, subjectID, argString(args, "week_id"))
	if problem != "" {
		return nil, errors.New(problem)
	}

	created := make([]map[string]any, 0, len(cards))
	for index, card := range cards {
		front := argString(card, "front")
		back := argString(card, "back")
		if front == "" || back == "" {
			return nil, fmt.Errorf("card %d needs both front and back", index+1)
		}
		id, now := util.NewID(), util.Now()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO flashcards (id, subject_id, front, back, week_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, subjectID, front, back, weekPlacementValue, now, now); err != nil {
			return nil, err
		}
		created = append(created, map[string]any{"id": id, "front": front, "back": back})
	}

	return map[string]any{
		"subject_id": subjectID, "cards": created, "count": len(created),
		"message": fmt.Sprintf("%d flashcard(s) created", len(created)),
	}, nil
}

func runCreateForumThread(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	subjectID := argString(args, "subject_id")
	title := argString(args, "title")
	body := argString(args, "body")
	switch {
	case subjectID == "":
		return nil, errors.New("subject_id is required; call list_subjects to find one")
	case title == "" || body == "":
		return nil, errors.New("title and body are required")
	case !rowExists(ctx, db, "subjects", subjectID):
		return nil, fmt.Errorf("unknown subject %q", subjectID)
	}
	if err := requireSubjectStaff(ctx, db, userID, subjectID); err != nil {
		return nil, err
	}

	now := util.Now()

	// A subject's forum is created on first use, so starting a topic never asks
	// the model to take a second step first.
	var forumID string
	err := db.QueryRowContext(ctx,
		`SELECT id FROM forums WHERE subject_id = ? ORDER BY created_at LIMIT 1`, subjectID).Scan(&forumID)
	if err == sql.ErrNoRows {
		var subjectName string
		if err := db.QueryRowContext(ctx, `SELECT name FROM subjects WHERE id = ?`, subjectID).
			Scan(&subjectName); err != nil {
			return nil, err
		}
		forumID = util.NewID()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO forums (id, subject_id, title, description, created_by, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			forumID, subjectID, subjectName+" forum", "Course questions and announcements.",
			userID, now, now); err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	var locked bool
	if err := db.QueryRowContext(ctx, `SELECT is_locked FROM forums WHERE id = ?`, forumID).Scan(&locked); err != nil {
		return nil, err
	}
	if locked {
		return nil, errors.New("this forum is locked")
	}

	threadID := util.NewID()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO forum_threads (id, forum_id, title, body, author_id, is_pinned, is_locked,
		                           last_post_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
		threadID, forumID, title, body, userID, now, now, now); err != nil {
		return nil, err
	}

	return map[string]any{
		"id": threadID, "forum_id": forumID, "subject_id": subjectID, "title": title,
		"message": "thread started",
	}, nil
}

func runPostForumReply(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	threadID := argString(args, "thread_id")
	body := argString(args, "body")
	switch {
	case threadID == "":
		return nil, errors.New("thread_id is required")
	case body == "":
		return nil, errors.New("body is required")
	}

	var threadLocked, forumLocked bool
	err := db.QueryRowContext(ctx, `
		SELECT t.is_locked, f.is_locked FROM forum_threads t
		JOIN forums f ON f.id = t.forum_id WHERE t.id = ?`, threadID).
		Scan(&threadLocked, &forumLocked)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("unknown thread %q", threadID)
	}
	if err != nil {
		return nil, err
	}
	if threadLocked || forumLocked {
		return nil, errors.New("this thread is locked")
	}

	id, now := util.NewID(), util.Now()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO forum_posts (id, thread_id, author_id, body, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`, id, threadID, userID, body, now, now); err != nil {
		return nil, err
	}
	if _, err := db.ExecContext(ctx,
		`UPDATE forum_threads SET last_post_at = ?, updated_at = ? WHERE id = ?`,
		now, now, threadID); err != nil {
		return nil, err
	}

	return map[string]any{"id": id, "thread_id": threadID, "message": "reply posted"}, nil
}

/* ---------- connections: who has the server switched on -------------------- */

// mcpServerConnected reports whether this person has connected the built-in
// SmartLMS server. Nothing else decides whether the assistant may write: the
// same connection the MCP tab shows is the switch the chat loop reads.
func mcpServerConnected(ctx context.Context, db *sql.DB, userID string) (bool, error) {
	var found string
	err := db.QueryRowContext(ctx,
		`SELECT app_key FROM user_mcp_apps WHERE user_id = ? AND app_key = ?`,
		userID, mcpServerKey).Scan(&found)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}
