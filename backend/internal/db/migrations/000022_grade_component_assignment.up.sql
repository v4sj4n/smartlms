-- 000022: a grade component can be an assignment
--
-- A lecturer either points a graded item at an existing assignment (its name
-- and max points come from the assignment, and its points follow the graded
-- submissions both ways) or adds a manual component such as Midterm or Final.
-- One assignment counts at most once, so the column is unique where it is set.

ALTER TABLE grade_components
  ADD COLUMN assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_components_assignment
  ON grade_components (assignment_id)
  WHERE assignment_id IS NOT NULL;
