package db

import (
	"context"
	"path/filepath"
	"slices"
	"testing"
)

// TestSeedGrantsStudentReadOnlySubjects pins the seed's STUDENT grants: the
// Subjects module (the sidebar entry and the screen, migration 000026) plus
// subjects.view (the read permission /api/subjects and the page gate check),
// and nothing that would let a student write. It runs the seed twice because the
// maps are applied with INSERT OR IGNORE and a duplicate row would break the
// composite primary keys' intent.
func TestSeedGrantsStudentReadOnlySubjects(t *testing.T) {
	ctx := context.Background()
	database, err := Open(filepath.Join(t.TempDir(), "seed.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := Migrate(ctx, database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	// Seeding twice must not duplicate the grants the maps add.
	for run := 0; run < 2; run++ {
		if err := Seed(ctx, database); err != nil {
			t.Fatalf("seed run %d: %v", run+1, err)
		}
	}

	cases := []struct {
		name string
		sql  string
		want int
	}{
		{
			// The Subjects screen and its sidebar entry.
			name: "student holds the subjects module",
			sql: `SELECT COUNT(*) FROM role_modules rm
			      JOIN roles r ON r.id = rm.role_id
			      JOIN modules m ON m.id = rm.module_id
			      WHERE r.name = 'STUDENT' AND m.key = 'subjects'`,
			want: 1,
		},
		{
			// What the /api/subjects route policy checks on a read.
			name: "student holds subjects.view",
			sql: `SELECT COUNT(*) FROM role_permissions rp
			      JOIN roles r ON r.id = rp.role_id
			      JOIN permissions p ON p.id = rp.permission_id
			      JOIN modules m ON m.id = p.module_id
			      WHERE r.name = 'STUDENT' AND m.key = 'subjects' AND p.key = 'subjects.view'`,
			want: 1,
		},
		{
			// Read-only: no create, edit or delete affordance for a student.
			name: "student does not hold subjects.manage",
			sql: `SELECT COUNT(*) FROM role_permissions rp
			      JOIN roles r ON r.id = rp.role_id
			      JOIN permissions p ON p.id = rp.permission_id
			      WHERE r.name = 'STUDENT' AND p.key = 'subjects.manage'`,
			want: 0,
		},
		{
			// The module grant is the only thing 000026 adds, so the
			// administrator surfaces must stay closed.
			name: "student holds no administration module",
			sql: `SELECT COUNT(*) FROM role_modules rm
			      JOIN roles r ON r.id = rm.role_id
			      JOIN modules m ON m.id = rm.module_id
			      WHERE r.name = 'STUDENT' AND m.key IN ('users', 'settings', 'students', 'campuses', 'academic', 'school-years')`,
			want: 0,
		},
		{
			name: "lecturer keeps subjects.manage",
			sql: `SELECT COUNT(*) FROM role_permissions rp
			      JOIN roles r ON r.id = rp.role_id
			      JOIN permissions p ON p.id = rp.permission_id
			      WHERE r.name = 'LECTURER' AND p.key = 'subjects.manage'`,
			want: 1,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var got int
			if err := database.QueryRowContext(ctx, tc.sql).Scan(&got); err != nil {
				t.Fatalf("query: %v", err)
			}
			if got != tc.want {
				t.Fatalf("got %d rows, want %d", got, tc.want)
			}
		})
	}
}

// TestSeedMapsGrantStudentSubjects guards the maps themselves, which the
// database assertion above cannot: migrations run on a brand-new database too,
// so a fresh boot would still look right if the STUDENT entry were dropped from
// seedRoleModules. The seed is the declaration of intent, so it is asserted
// directly.
func TestSeedMapsGrantStudentSubjects(t *testing.T) {
	if !slices.Contains(seedRoleModules["STUDENT"], "subjects") {
		t.Fatal("seedRoleModules[STUDENT] must include subjects")
	}
	if !slices.Contains(seedRoleGrants["STUDENT"], "subjects.view") {
		t.Fatal("seedRoleGrants[STUDENT] must include subjects.view")
	}
	if slices.Contains(seedRoleGrants["STUDENT"], "subjects.manage") {
		t.Fatal("STUDENT must stay read-only on subjects")
	}
}
