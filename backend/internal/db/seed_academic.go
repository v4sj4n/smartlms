package db

import (
	"context"
	"database/sql"
	"fmt"

	"optimolms/backend/internal/util"
)

// The demo university: faculties hold departments, departments hold the
// programmes students are admitted to. Fixed data, so every fresh database has
// the same structure to look at.
type seedProgramme struct {
	name        string
	code        string
	level       string
	years       int
	totalECTS   int
	description string
}

type seedDepartment struct {
	name       string
	code       string
	programmes []seedProgramme
}

type seedFaculty struct {
	name        string
	code        string
	departments []seedDepartment
}

var seedUniversity = []seedFaculty{
	{
		name: "Faculty of Natural Sciences",
		code: "FNS",
		departments: []seedDepartment{
			{
				name: "Department of Computer Science",
				code: "CS",
				programmes: []seedProgramme{
					{"Computer Science", "BSc-CS", "BACHELOR", 3, 180, "Algorithms, systems and software."},
					{"Software Engineering", "BSc-SE", "BACHELOR", 3, 180, "Building and maintaining software products."},
					{"Data Science", "MSc-DS", "MASTER", 2, 120, "Statistics, machine learning and data engineering."},
				},
			},
			{
				name: "Department of Mathematics",
				code: "MATH",
				programmes: []seedProgramme{
					{"Mathematics", "BSc-MATH", "BACHELOR", 3, 180, "Pure and applied mathematics."},
				},
			},
		},
	},
	{
		name: "Faculty of Economics",
		code: "FE",
		departments: []seedDepartment{
			{
				name: "Department of Business Administration",
				code: "BUS",
				programmes: []seedProgramme{
					{"Business Administration", "BSc-BA", "BACHELOR", 3, 180, "Management, marketing and operations."},
				},
			},
			{
				name: "Department of Finance",
				code: "FIN",
				programmes: []seedProgramme{
					{"Finance and Banking", "MSc-FB", "MASTER", 2, 120, "Corporate finance, banking and risk."},
				},
			},
		},
	},
}

// The demo subjects belong to the first year of Computer Science, and the demo
// student follows that programme, so the sample data reads as one story.
var seedSubjectProgrammes = []struct {
	subjectCode string
	programme   string
	year        int
}{
	{"MATH101", "BSc-CS", 1},
	{"PHYS101", "BSc-CS", 1},
}

const seedDemoStudentProgramme = "BSc-CS"

// seedAcademicStructure creates the faculty/department/programme tree and puts
// the demo subject and the demo student into a programme. Skipped once any
// faculty exists, so an institution's own structure is never overwritten.
func seedAcademicStructure(ctx context.Context, db *sql.DB) error {
	var count int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM faculties`).Scan(&count); err != nil {
		return fmt.Errorf("count faculties: %w", err)
	}
	if count > 0 {
		return nil
	}

	now := util.Now()
	programmeID := map[string]string{} // code -> id

	for _, faculty := range seedUniversity {
		facultyID := util.NewID()
		if _, err := db.ExecContext(ctx, `
			INSERT INTO faculties (id, name, code, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?)`,
			facultyID, faculty.name, faculty.code, now, now); err != nil {
			return fmt.Errorf("seed faculty %s: %w", faculty.name, err)
		}

		for _, department := range faculty.departments {
			departmentID := util.NewID()
			if _, err := db.ExecContext(ctx, `
				INSERT INTO departments (id, faculty_id, name, code, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?)`,
				departmentID, facultyID, department.name, department.code, now, now); err != nil {
				return fmt.Errorf("seed department %s: %w", department.name, err)
			}

			for _, programme := range department.programmes {
				id := util.NewID()
				if _, err := db.ExecContext(ctx, `
					INSERT INTO programmes (id, department_id, name, code, level, duration_years,
					                        total_ects, description, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					id, departmentID, programme.name, programme.code, programme.level,
					programme.years, programme.totalECTS, programme.description, now, now); err != nil {
					return fmt.Errorf("seed programme %s: %w", programme.name, err)
				}
				programmeID[programme.code] = id
			}
		}
	}

	for _, link := range seedSubjectProgrammes {
		id, ok := programmeID[link.programme]
		if !ok {
			continue
		}
		if _, err := db.ExecContext(ctx, `
			UPDATE subjects SET programme_id = ?, year_of_study = ?, updated_at = ?
			WHERE code = ? AND programme_id IS NULL`,
			id, link.year, now, link.subjectCode); err != nil {
			return fmt.Errorf("seed subject programme %s: %w", link.subjectCode, err)
		}
	}

	if id, ok := programmeID[seedDemoStudentProgramme]; ok {
		if err := admitStudent(ctx, db, id, "student@optimolms.dev", seedCurrentYear(ctx, db), 1); err != nil {
			return err
		}
	}
	return nil
}

// seedAdmissions admits every student who has no programme yet, spreading them
// across the catalog so each programme has a cohort. It runs on every boot so a
// database that predates the academic structure gains admissions, while a
// student an administrator placed is never moved.
func seedAdmissions(ctx context.Context, db *sql.DB) error {
	type programme struct {
		id    string
		years int
	}
	rows, err := db.QueryContext(ctx, `SELECT id, duration_years FROM programmes ORDER BY code`)
	if err != nil {
		return fmt.Errorf("list programmes: %w", err)
	}
	programmes := []programme{}
	for rows.Next() {
		var p programme
		if err := rows.Scan(&p.id, &p.years); err != nil {
			rows.Close()
			return fmt.Errorf("scan programme: %w", err)
		}
		programmes = append(programmes, p)
	}
	rows.Close()
	if len(programmes) == 0 {
		return nil
	}

	studentRows, err := db.QueryContext(ctx, `
		SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
		WHERE r.name = 'STUDENT'
		  AND NOT EXISTS (
		    SELECT 1 FROM programme_enrollments e
		    WHERE e.student_id = u.id AND e.status = 'ACTIVE'
		  )
		ORDER BY u.email`)
	if err != nil {
		return fmt.Errorf("list unplaced students: %w", err)
	}
	studentIDs := []string{}
	for studentRows.Next() {
		var id string
		if err := studentRows.Scan(&id); err != nil {
			studentRows.Close()
			return fmt.Errorf("scan student: %w", err)
		}
		studentIDs = append(studentIDs, id)
	}
	studentRows.Close()

	year := seedCurrentYear(ctx, db)
	for index, studentID := range studentIDs {
		target := programmes[index%len(programmes)]
		yearOfStudy := index%min(target.years, 3) + 1
		if err := admitStudent(ctx, db, target.id, studentID, year, yearOfStudy); err != nil {
			return err
		}
	}
	return nil
}

// admitStudent places a student in a programme, resolving the student by id or
// by email. An already admitted student is left alone, so seeding is idempotent.
func admitStudent(ctx context.Context, db *sql.DB, programmeID, studentRef, schoolYear string, yearOfStudy int) error {
	studentID := studentRef
	var byEmail string
	err := db.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, studentRef).Scan(&byEmail)
	if err == nil {
		studentID = byEmail
	} else if err != sql.ErrNoRows {
		return fmt.Errorf("lookup student %s: %w", studentRef, err)
	}

	var existing int
	if err := db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM programme_enrollments
		WHERE student_id = ? AND status = 'ACTIVE'`, studentID).Scan(&existing); err != nil {
		return fmt.Errorf("check admission %s: %w", studentRef, err)
	}
	if existing > 0 {
		return nil
	}

	now := util.Now()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO programme_enrollments
		  (id, programme_id, student_id, school_year, year_of_study, status, enrolled_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
		util.NewID(), programmeID, studentID, nullString(schoolYear), yearOfStudy, now, now); err != nil {
		return fmt.Errorf("admit student %s: %w", studentRef, err)
	}
	return nil
}

// seedCurrentYear is the academic year the school is running, empty when none
// has been activated yet.
func seedCurrentYear(ctx context.Context, db *sql.DB) string {
	var name string
	if err := db.QueryRowContext(ctx,
		`SELECT name FROM school_years WHERE is_active = 1 LIMIT 1`).Scan(&name); err != nil {
		return ""
	}
	return name
}

func nullString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
