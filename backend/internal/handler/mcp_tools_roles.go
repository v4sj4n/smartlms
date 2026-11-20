package handler

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"optimolms/backend/internal/util"
)

/*
Role-shaped MCP tools.

A tool's Permission decides whether someone sees it at all. That alone is not
enough: "assignments.grade" must not let a lecturer grade another lecturer's
subject, and "grades.view" must not let a student read a classmate's grades.
So every tool here also scopes its rows to the caller:

  - ADMIN sees and acts on everything.
  - LECTURER acts on the subjects they teach.
  - everyone else (students) reads the subjects they are enrolled in, and only
    their own submissions, attempts and grades.

What the server offers therefore differs per person: a student gets their
courses, assignments, grades, quizzes, flashcards and forums; a lecturer adds
authoring and grading on their own subjects; an admin adds users and school
years on top.
*/

// subjectAccess reports how the caller relates to a subject.
type subjectAccess int

const (
	accessNone subjectAccess = iota
	accessEnrolled
	accessStaff
)

func subjectAccessFor(ctx context.Context, db *sql.DB, userID, subjectID string) (subjectAccess, error) {
	var lecturer sql.NullString
	err := db.QueryRowContext(ctx, `SELECT lecturer_id FROM subjects WHERE id = ?`, subjectID).Scan(&lecturer)
	if err == sql.ErrNoRows {
		return accessNone, fmt.Errorf("unknown subject %q", subjectID)
	}
	if err != nil {
		return accessNone, err
	}
	role, err := roleOf(ctx, db, userID)
	if err != nil {
		return accessNone, errors.New("unknown user")
	}
	if role == "ADMIN" || (lecturer.Valid && lecturer.String == userID) {
		return accessStaff, nil
	}
	var n int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM enrollments WHERE student_id = ? AND subject_id = ?`, userID, subjectID).
		Scan(&n); err != nil {
		return accessNone, err
	}
	if n > 0 {
		return accessEnrolled, nil
	}
	return accessNone, nil
}

// requireSubjectReader allows staff and enrolled students.
func requireSubjectReader(ctx context.Context, db *sql.DB, userID, subjectID string) error {
	access, err := subjectAccessFor(ctx, db, userID, subjectID)
	if err != nil {
		return err
	}
	if access == accessNone {
		return errors.New("you are not enrolled in or teaching this subject")
	}
	return nil
}

// onOwnSubject wraps a write tool so it only runs on a subject the caller
// teaches (or any subject, for an admin). subjectOf finds the subject from the
// arguments; most tools take subject_id directly.
func onOwnSubject(
	subjectOf func(ctx context.Context, db *sql.DB, args map[string]any) (string, error),
	run func(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error),
) func(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	return func(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
		subjectID, err := subjectOf(ctx, db, args)
		if err != nil {
			return nil, err
		}
		if subjectID != "" { // empty: let the tool report its own "required" error
			if err := requireSubjectStaff(ctx, db, userID, subjectID); err != nil {
				return nil, err
			}
		}
		return run(ctx, db, userID, args)
	}
}

// onReadableSubject is onOwnSubject's read twin: staff or enrolled students.
func onReadableSubject(
	subjectOf func(ctx context.Context, db *sql.DB, args map[string]any) (string, error),
	run func(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error),
) func(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	return func(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
		subjectID, err := subjectOf(ctx, db, args)
		if err != nil {
			return nil, err
		}
		if subjectID != "" {
			if err := requireSubjectReader(ctx, db, userID, subjectID); err != nil {
				return nil, err
			}
		}
		return run(ctx, db, userID, args)
	}
}

func subjectFromArg(_ context.Context, _ *sql.DB, args map[string]any) (string, error) {
	return argString(args, "subject_id"), nil
}

func subjectFromRow(query, argKey, label string) func(ctx context.Context, db *sql.DB, args map[string]any) (string, error) {
	return func(ctx context.Context, db *sql.DB, args map[string]any) (string, error) {
		id := argString(args, argKey)
		if id == "" {
			return "", nil
		}
		var subjectID string
		err := db.QueryRowContext(ctx, query, id).Scan(&subjectID)
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("unknown %s %q", label, id)
		}
		return subjectID, err
	}
}

var (
	subjectFromQuiz       = subjectFromRow(`SELECT subject_id FROM quizzes WHERE id = ?`, "quiz_id", "quiz")
	subjectFromAssignment = subjectFromRow(`SELECT subject_id FROM assignments WHERE id = ?`, "assignment_id", "assignment")
	subjectFromThread     = subjectFromRow(`
		SELECT f.subject_id FROM forum_threads t JOIN forums f ON f.id = t.forum_id WHERE t.id = ?`,
		"thread_id", "thread")
	subjectFromSubmission = subjectFromRow(`
		SELECT a.subject_id FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id
		WHERE s.id = ?`, "submission_id", "submission")
)

/* ---------- the role catalogue -------------------------------------------- */

func roleMCPTools() []mcpTool {
	subjectID := schemaProp("string", "Subject id, from list_my_courses")
	return []mcpTool{
		// ---- everyone who studies or teaches -------------------------------
		{
			Name: "list_my_courses", Title: "My courses", Module: "lectures",
			Permission: "lectures.view",
			Description: "The subjects you are enrolled in (students), teach (lecturers) or all of them " +
				"(admins), each with its upcoming lectures. Start here to find subject ids.",
			InputSchema: schemaObject(map[string]any{}),
			Run:         runListMyCourses,
		},
		{
			Name: "list_my_assignments", Title: "My assignments", Module: "assignments",
			Permission: "assignments.view",
			Description: "Published assignments in your enrolled subjects with due dates, your submission " +
				"status, score and feedback.",
			InputSchema: schemaObject(map[string]any{}),
			Run:         runListMyAssignments,
		},
		{
			Name: "submit_assignment", Title: "Submit assignment", Module: "assignments",
			Permission:  "assignments.submit",
			Description: "Hand in (or resubmit, until graded) your written answer or file link for an assignment.",
			InputSchema: schemaObject(map[string]any{
				"assignment_id": schemaProp("string", "Assignment id, from list_my_assignments"),
				"content":       schemaProp("string", "Your written answer"),
				"file_url":      schemaProp("string", "Optional link to your file"),
			}, "assignment_id"),
			Run: runSubmitAssignment,
		},
		{
			Name: "my_grades", Title: "My grades", Module: "grades",
			Permission:  "grades.view",
			Description: "Your weighted grade breakdown in every subject you are enrolled in.",
			InputSchema: schemaObject(map[string]any{}),
			Run:         runMyGrades,
		},
		{
			Name: "list_quizzes", Title: "List quizzes", Module: "quizzes",
			Permission:  "quizzes.view",
			Description: "Quizzes in a subject you take or teach, with your best score so far.",
			InputSchema: schemaObject(map[string]any{"subject_id": subjectID}, "subject_id"),
			Run:         onReadableSubject(subjectFromArg, runListQuizzes),
		},
		{
			Name: "study_flashcards", Title: "Study flashcards", Module: "flashcards",
			Permission:  "flashcards.view",
			Description: "The flashcard sets of a subject you take or teach, each with its front/back cards.",
			InputSchema: schemaObject(map[string]any{"subject_id": subjectID}, "subject_id"),
			Run:         onReadableSubject(subjectFromArg, runStudyFlashcards),
		},
		{
			Name: "list_forum_threads", Title: "List forum threads", Module: "forums",
			Permission:  "forums.view",
			Description: "Threads in a subject's course forum, pinned first then most recently active.",
			InputSchema: schemaObject(map[string]any{"subject_id": subjectID}, "subject_id"),
			Run:         onReadableSubject(subjectFromArg, runListForumThreads),
		},
		{
			Name: "read_forum_thread", Title: "Read forum thread", Module: "forums",
			Permission:  "forums.view",
			Description: "A forum thread's opening post and its replies.",
			InputSchema: schemaObject(map[string]any{
				"thread_id": schemaProp("string", "Thread id, from list_forum_threads"),
			}, "thread_id"),
			Run: onReadableSubject(subjectFromThread, runReadForumThread),
		},

		// ---- lecturers: grading their own subjects ---------------------------
		{
			Name: "list_submissions", Title: "List submissions", Module: "assignments",
			Permission:  "assignments.grade",
			Description: "The grading queue for an assignment in a subject you teach.",
			InputSchema: schemaObject(map[string]any{
				"assignment_id": schemaProp("string", "Assignment id"),
			}, "assignment_id"),
			Run: onOwnSubject(subjectFromAssignment, runListSubmissions),
		},
		{
			Name: "grade_submission", Title: "Grade submission", Module: "assignments",
			Permission:  "assignments.grade",
			Description: "Score a submission (0..max_points) and leave feedback, in a subject you teach.",
			InputSchema: schemaObject(map[string]any{
				"submission_id": schemaProp("string", "Submission id, from list_submissions"),
				"score":         schemaProp("number", "Points awarded"),
				"feedback":      schemaProp("string", "Optional feedback for the student"),
			}, "submission_id", "score"),
			Run: onOwnSubject(subjectFromSubmission, runGradeSubmission),
		},

		// ---- administrators -------------------------------------------------
		{
			Name: "list_users", Title: "List users", Module: "users",
			Permission:  "users.view",
			Description: "User accounts with their role, optionally filtered by role or a name/email search.",
			InputSchema: schemaObject(map[string]any{
				"role":   schemaProp("string", "Optional ADMIN, LECTURER or STUDENT"),
				"search": schemaProp("string", "Optional part of a name or email"),
			}),
			Run: runListUsers,
		},
		{
			Name: "list_school_years", Title: "List school years", Module: "school-years",
			Permission:  "school-years.view",
			Description: "The school years and which one is current.",
			InputSchema: schemaObject(map[string]any{}),
			Run:         runListSchoolYears,
		},
		{
			Name: "set_active_school_year", Title: "Set current school year", Module: "school-years",
			Permission:  "school-years.manage",
			Description: "Make a school year the current one (exactly one is current at a time).",
			InputSchema: schemaObject(map[string]any{
				"name": schemaProp("string", "School year, e.g. 2026/2027"),
			}, "name"),
			Run: runSetActiveSchoolYear,
		},
	}
}

/* ---------- tool bodies ---------------------------------------------------- */

func runListMyCourses(ctx context.Context, db *sql.DB, userID string, _ map[string]any) (any, error) {
	role, err := roleOf(ctx, db, userID)
	if err != nil {
		return nil, errors.New("unknown user")
	}
	where, params := "", []any{}
	switch role {
	case "ADMIN":
	case "LECTURER":
		where, params = ` WHERE s.lecturer_id = ?`, []any{userID}
	default:
		where, params = ` WHERE s.id IN (SELECT subject_id FROM enrollments WHERE student_id = ?)`, []any{userID}
	}
	rows, err := db.QueryContext(ctx, `
		SELECT s.id, s.name, COALESCE(s.code, ''), COALESCE(s.school_year, ''), s.semester,
		       COALESCE(u.name, '')
		FROM subjects s LEFT JOIN users u ON u.id = s.lecturer_id`+where+` ORDER BY s.name LIMIT 100`, params...)
	if err != nil {
		return nil, err
	}
	courses := []map[string]any{}
	for rows.Next() {
		var id, name, code, year, semester, lecturer string
		if err := rows.Scan(&id, &name, &code, &year, &semester, &lecturer); err != nil {
			rows.Close()
			return nil, err
		}
		courses = append(courses, map[string]any{
			"id": id, "name": name, "code": code, "school_year": year, "semester": semester, "lecturer": lecturer,
		})
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	now := util.Now()
	for _, course := range courses {
		lectureRows, err := db.QueryContext(ctx, `
			SELECT id, title, COALESCE(scheduled_at, '') FROM lectures
			WHERE subject_id = ? AND scheduled_at >= ? ORDER BY scheduled_at LIMIT 5`, course["id"], now)
		if err != nil {
			return nil, err
		}
		upcoming := []map[string]any{}
		for lectureRows.Next() {
			var id, title, at string
			if err := lectureRows.Scan(&id, &title, &at); err != nil {
				lectureRows.Close()
				return nil, err
			}
			upcoming = append(upcoming, map[string]any{"id": id, "title": title, "scheduled_at": at})
		}
		lectureRows.Close()
		course["upcoming_lectures"] = upcoming
	}
	return map[string]any{"role": role, "courses": courses, "count": len(courses)}, nil
}

func runListMyAssignments(ctx context.Context, db *sql.DB, userID string, _ map[string]any) (any, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT a.id, a.title, s.id, s.name, COALESCE(a.due_at, ''), a.max_points, a.allow_late,
		       a.submission_type, COALESCE(sub.status, ''), sub.score, COALESCE(sub.feedback, '')
		FROM assignments a
		JOIN subjects s ON s.id = a.subject_id
		JOIN enrollments e ON e.subject_id = a.subject_id AND e.student_id = ?
		LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
		WHERE a.is_published = 1
		ORDER BY a.due_at IS NULL, a.due_at, s.name, a.title`, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, title, subjectID, subjectName, dueAt, submissionType, status, feedback string
		var maxPoints int
		var allowLate bool
		var score *float64
		if err := rows.Scan(&id, &title, &subjectID, &subjectName, &dueAt, &maxPoints, &allowLate,
			&submissionType, &status, &score, &feedback); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "title": title, "subject_id": subjectID, "subject": subjectName, "due_at": dueAt,
			"max_points": maxPoints, "submission_type": submissionType,
			"status": assignmentStatus(status, dueAt, allowLate, score), "score": score, "feedback": feedback,
		})
	}
	return map[string]any{"assignments": out, "count": len(out)}, rows.Err()
}

func runSubmitAssignment(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	assignmentID := argString(args, "assignment_id")
	content := argString(args, "content")
	fileURL := argString(args, "file_url")
	if assignmentID == "" {
		return nil, errors.New("assignment_id is required; call list_my_assignments")
	}

	var dueAt, submissionType string
	var allowLate, published bool
	err := db.QueryRowContext(ctx, `
		SELECT COALESCE(a.due_at, ''), a.allow_late, a.submission_type, a.is_published
		FROM assignments a
		JOIN enrollments e ON e.subject_id = a.subject_id AND e.student_id = ?
		WHERE a.id = ?`, userID, assignmentID).Scan(&dueAt, &allowLate, &submissionType, &published)
	if err == sql.ErrNoRows {
		return nil, errors.New("you are not enrolled in this assignment's subject")
	}
	if err != nil {
		return nil, err
	}
	switch {
	case !published:
		return nil, errors.New("assignment is not published")
	case submissionType == "file" && fileURL == "":
		return nil, errors.New("this assignment needs a file_url")
	case submissionType == "text" && content == "":
		return nil, errors.New("this assignment needs a written answer in content")
	case content == "" && fileURL == "":
		return nil, errors.New("content or file_url is required")
	}

	status := "submitted"
	switch assignmentStatus("", dueAt, allowLate, nil) {
	case "closed":
		return nil, errors.New("the deadline has passed")
	case "overdue":
		status = "late"
	}

	now := util.Now()
	var existingID, existingStatus string
	err = db.QueryRowContext(ctx,
		`SELECT id, status FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?`,
		assignmentID, userID).Scan(&existingID, &existingStatus)
	switch {
	case err == nil && existingStatus == "graded":
		return nil, errors.New("this submission has already been graded")
	case err == nil:
		_, err = db.ExecContext(ctx, `
			UPDATE assignment_submissions SET content = ?, file_url = ?, status = ?, submitted_at = ?, updated_at = ?
			WHERE id = ?`, content, nullIfEmpty(fileURL), status, now, now, existingID)
	case err == sql.ErrNoRows:
		existingID = util.NewID()
		_, err = db.ExecContext(ctx, `
			INSERT INTO assignment_submissions (id, assignment_id, student_id, content, file_url, status, submitted_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			existingID, assignmentID, userID, content, nullIfEmpty(fileURL), status, now, now)
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": existingID, "status": status, "message": "submission saved"}, nil
}

func runMyGrades(ctx context.Context, db *sql.DB, userID string, _ map[string]any) (any, error) {
	subjects, err := buildStudentGrades(ctx, db, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"subjects": subjects, "count": len(subjects)}, nil
}

func runListQuizzes(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT q.id, q.title, COALESCE(q.description, ''), COALESCE(q.time_limit_minutes, 0),
		       (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id = q.id),
		       (SELECT MAX(score) FROM quiz_attempts a WHERE a.quiz_id = q.id AND a.student_id = ? AND a.status = 'completed')
		FROM quizzes q WHERE q.subject_id = ? ORDER BY q.created_at`, userID, argString(args, "subject_id"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, title, description string
		var limit, questions int
		var best *int
		if err := rows.Scan(&id, &title, &description, &limit, &questions, &best); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "title": title, "description": description, "time_limit_minutes": limit,
			"questions": questions, "my_best_score": best,
		})
	}
	return map[string]any{"quizzes": out, "count": len(out)}, rows.Err()
}

func runStudyFlashcards(ctx context.Context, db *sql.DB, _ string, args map[string]any) (any, error) {
	sets, err := loadFlashcardSets(ctx, db, argString(args, "subject_id"))
	if err != nil {
		return nil, err
	}
	return map[string]any{"sets": sets, "count": len(sets)}, nil
}

func runListForumThreads(ctx context.Context, db *sql.DB, _ string, args map[string]any) (any, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT t.id, t.title, COALESCE(u.name, ''), t.is_pinned, t.is_locked, t.last_post_at,
		       (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL)
		FROM forum_threads t
		JOIN forums f ON f.id = t.forum_id
		LEFT JOIN users u ON u.id = t.author_id
		WHERE f.subject_id = ?
		ORDER BY t.is_pinned DESC, t.last_post_at DESC LIMIT 50`, argString(args, "subject_id"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	threads := []map[string]any{}
	for rows.Next() {
		var id, title, author, lastPost string
		var pinned, locked bool
		var replies int
		if err := rows.Scan(&id, &title, &author, &pinned, &locked, &lastPost, &replies); err != nil {
			return nil, err
		}
		threads = append(threads, map[string]any{
			"id": id, "title": title, "author": author, "pinned": pinned, "locked": locked,
			"last_post_at": lastPost, "replies": replies,
		})
	}
	return map[string]any{"threads": threads, "count": len(threads)}, rows.Err()
}

func runReadForumThread(ctx context.Context, db *sql.DB, _ string, args map[string]any) (any, error) {
	threadID := argString(args, "thread_id")
	if threadID == "" {
		return nil, errors.New("thread_id is required")
	}
	var title, body, author, createdAt string
	var locked bool
	if err := db.QueryRowContext(ctx, `
		SELECT t.title, t.body, COALESCE(u.name, ''), t.created_at, t.is_locked
		FROM forum_threads t LEFT JOIN users u ON u.id = t.author_id WHERE t.id = ?`, threadID).
		Scan(&title, &body, &author, &createdAt, &locked); err != nil {
		return nil, err
	}
	rows, err := db.QueryContext(ctx, `
		SELECT p.id, COALESCE(u.name, ''), p.body, p.created_at
		FROM forum_posts p LEFT JOIN users u ON u.id = p.author_id
		WHERE p.thread_id = ? AND p.deleted_at IS NULL ORDER BY p.created_at LIMIT 200`, threadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	replies := []map[string]any{}
	for rows.Next() {
		var id, replyAuthor, replyBody, at string
		if err := rows.Scan(&id, &replyAuthor, &replyBody, &at); err != nil {
			return nil, err
		}
		replies = append(replies, map[string]any{"id": id, "author": replyAuthor, "body": replyBody, "created_at": at})
	}
	return map[string]any{
		"id": threadID, "title": title, "body": body, "author": author, "created_at": createdAt,
		"locked": locked, "replies": replies,
	}, rows.Err()
}

func runListSubmissions(ctx context.Context, db *sql.DB, _ string, args map[string]any) (any, error) {
	assignmentID := argString(args, "assignment_id")
	if assignmentID == "" {
		return nil, errors.New("assignment_id is required")
	}
	rows, err := db.QueryContext(ctx, `
		SELECT s.id, u.name, u.email, COALESCE(s.content, ''), COALESCE(s.file_url, ''), s.status,
		       s.score, COALESCE(s.feedback, ''), s.submitted_at,
		       f.file_name, f.file_kind, f.file_size
		FROM assignment_submissions s JOIN users u ON u.id = s.student_id
		LEFT JOIN submission_files f ON f.submission_id = s.id
		WHERE s.assignment_id = ? ORDER BY s.submitted_at`, assignmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, email, content, fileURL, status, feedback, submittedAt string
		var fileName, fileKind sql.NullString
		var fileSize sql.NullInt64
		var score *float64
		if err := rows.Scan(&id, &name, &email, &content, &fileURL, &status, &score, &feedback, &submittedAt,
			&fileName, &fileKind, &fileSize); err != nil {
			return nil, err
		}
		row := map[string]any{
			"id": id, "student": name, "email": email, "content": content, "file_url": fileURL,
			"status": status, "score": score, "feedback": feedback, "submitted_at": submittedAt,
			"file_name": nil, "file_kind": nil, "file_size": nil,
		}
		if fileName.Valid {
			row["file_name"] = fileName.String
		}
		if fileKind.Valid {
			row["file_kind"] = fileKind.String
		}
		if fileSize.Valid {
			row["file_size"] = fileSize.Int64
		}
		out = append(out, row)
	}
	return map[string]any{"submissions": out, "count": len(out)}, rows.Err()
}

func runGradeSubmission(ctx context.Context, db *sql.DB, userID string, args map[string]any) (any, error) {
	submissionID := argString(args, "submission_id")
	if submissionID == "" {
		return nil, errors.New("submission_id is required")
	}
	if _, ok := args["score"]; !ok {
		return nil, errors.New("score is required")
	}
	score := argFloat(args, "score")
	var maxPoints int
	if err := db.QueryRowContext(ctx, `
		SELECT a.max_points FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id
		WHERE s.id = ?`, submissionID).Scan(&maxPoints); err != nil {
		return nil, err
	}
	if score < 0 || score > float64(maxPoints) {
		return nil, fmt.Errorf("score must be between 0 and %d", maxPoints)
	}
	now := util.Now()
	if _, err := db.ExecContext(ctx, `
		UPDATE assignment_submissions
		SET score = ?, feedback = ?, status = 'graded', graded_at = ?, graded_by = ?, updated_at = ?
		WHERE id = ?`, score, argString(args, "feedback"), now, userID, now, submissionID); err != nil {
		return nil, err
	}
	return map[string]any{"id": submissionID, "score": score, "status": "graded", "message": "submission graded"}, nil
}

func runListUsers(ctx context.Context, db *sql.DB, _ string, args map[string]any) (any, error) {
	query := `SELECT u.id, u.name, u.email, r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE 1 = 1`
	params := []any{}
	if role := strings.ToUpper(argString(args, "role")); role != "" {
		query += ` AND r.name = ?`
		params = append(params, role)
	}
	if search := argString(args, "search"); search != "" {
		query += ` AND (u.name LIKE ? OR u.email LIKE ?)`
		params = append(params, "%"+search+"%", "%"+search+"%")
	}
	rows, err := db.QueryContext(ctx, query+` ORDER BY u.name LIMIT 100`, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []map[string]any{}
	for rows.Next() {
		var id, name, email, role string
		if err := rows.Scan(&id, &name, &email, &role); err != nil {
			return nil, err
		}
		users = append(users, map[string]any{"id": id, "name": name, "email": email, "role": role})
	}
	return map[string]any{"users": users, "count": len(users)}, rows.Err()
}

func runListSchoolYears(ctx context.Context, db *sql.DB, _ string, _ map[string]any) (any, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT name, COALESCE(starts_on, ''), COALESCE(ends_on, ''), is_active FROM school_years ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	years := []map[string]any{}
	for rows.Next() {
		var name, starts, ends string
		var active bool
		if err := rows.Scan(&name, &starts, &ends, &active); err != nil {
			return nil, err
		}
		years = append(years, map[string]any{"name": name, "starts_on": starts, "ends_on": ends, "is_active": active})
	}
	return map[string]any{"school_years": years}, rows.Err()
}

func runSetActiveSchoolYear(ctx context.Context, db *sql.DB, _ string, args map[string]any) (any, error) {
	name := argString(args, "name")
	if name == "" {
		return nil, errors.New("name is required")
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	now := util.Now()
	if _, err := tx.ExecContext(ctx,
		`UPDATE school_years SET is_active = 0, updated_at = ? WHERE is_active = 1`, now); err != nil {
		return nil, err
	}
	result, err := tx.ExecContext(ctx,
		`UPDATE school_years SET is_active = 1, updated_at = ? WHERE name = ?`, now, name)
	if err != nil {
		return nil, err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return nil, fmt.Errorf("unknown school year %q; call list_school_years", name)
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return map[string]any{"name": name, "is_active": true, "message": "current school year set"}, nil
}
