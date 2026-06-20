-- Enhance course_schedules with new academic structure fields
ALTER TABLE course_schedules
  ADD COLUMN group_id uuid REFERENCES student_groups(id) ON DELETE SET NULL,
  ADD COLUMN subject_assignment_id uuid REFERENCES subject_assignments(id) ON DELETE SET NULL,
  ADD COLUMN academic_year_id uuid REFERENCES school_years(id) ON DELETE SET NULL;

-- Add indexes for scheduling queries
CREATE INDEX idx_course_schedules_group ON course_schedules(group_id);
CREATE INDEX idx_course_schedules_subject_assignment ON course_schedules(subject_assignment_id);
CREATE INDEX idx_course_schedules_academic_year ON course_schedules(academic_year_id);
CREATE INDEX idx_course_schedules_course ON course_schedules(course_id);

-- Composite index for schedule retrieval by academic year
CREATE INDEX idx_course_schedules_year_day_time ON course_schedules(academic_year_id, day_of_week, start_time);

-- Add comments
COMMENT ON COLUMN course_schedules.group_id IS 'Student group attending this schedule entry';
COMMENT ON COLUMN course_schedules.subject_assignment_id IS 'Link to subject assignment (professor-subject-group)';
COMMENT ON COLUMN course_schedules.academic_year_id IS 'Academic year for this schedule entry';
