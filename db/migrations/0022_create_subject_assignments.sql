-- Create subject_assignments table (links professors to subjects for specific groups)
CREATE TABLE subject_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  required_hours integer NOT NULL DEFAULT 2,
  created_at timestamp DEFAULT NOW() NOT NULL,
  updated_at timestamp DEFAULT NOW() NOT NULL,
  UNIQUE (professor_id, course_id, group_id)
);

-- Add indexes for scheduling queries
CREATE INDEX idx_subject_assignments_professor ON subject_assignments(professor_id);
CREATE INDEX idx_subject_assignments_course ON subject_assignments(course_id);
CREATE INDEX idx_subject_assignments_group ON subject_assignments(group_id);
CREATE INDEX idx_subject_assignments_professor_course ON subject_assignments(professor_id, course_id);

-- Add comments
COMMENT ON TABLE subject_assignments IS 'Defines which professor teaches which subject to which group';
COMMENT ON COLUMN subject_assignments.required_hours IS 'Weekly hours required for this subject-group combination';
