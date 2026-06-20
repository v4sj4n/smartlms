-- Create student_groups table
CREATE TABLE student_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  study_program_id uuid NOT NULL REFERENCES study_programs(id) ON DELETE CASCADE,
  year_level integer NOT NULL DEFAULT 1,
  capacity integer DEFAULT 30,
  created_at timestamp DEFAULT NOW() NOT NULL,
  updated_at timestamp DEFAULT NOW() NOT NULL
);

-- Add indexes for common queries
CREATE INDEX idx_student_groups_program ON student_groups(study_program_id);
CREATE INDEX idx_student_groups_year ON student_groups(year_level);
CREATE INDEX idx_student_groups_program_year ON student_groups(study_program_id, year_level);

-- Add comments
COMMENT ON TABLE student_groups IS 'Student class groups within study programs';
COMMENT ON COLUMN student_groups.year_level IS 'Academic year level (1, 2, 3, 4, etc.)';
COMMENT ON COLUMN student_groups.capacity IS 'Maximum number of students in group';

-- Create student_group_members table for many-to-many relationship
CREATE TABLE student_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamp DEFAULT NOW() NOT NULL,
  UNIQUE (group_id, student_id)
);

CREATE INDEX idx_student_group_members_group ON student_group_members(group_id);
CREATE INDEX idx_student_group_members_student ON student_group_members(student_id);

COMMENT ON TABLE student_group_members IS 'Many-to-many relationship between students and groups';
