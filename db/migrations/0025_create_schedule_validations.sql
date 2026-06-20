-- Create schedule_validations table for audit history
CREATE TABLE schedule_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  validated_at timestamp DEFAULT NOW() NOT NULL,
  is_valid boolean NOT NULL,
  conflicts jsonb DEFAULT '[]' NOT NULL,
  conflict_count integer DEFAULT 0 NOT NULL,
  generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  generation_mode text DEFAULT 'manual',
  validation_duration_ms integer,
  metadata jsonb DEFAULT '{}'
);

-- Add indexes
CREATE INDEX idx_schedule_validations_year ON schedule_validations(academic_year_id);
CREATE INDEX idx_schedule_validations_validated_at ON schedule_validations(validated_at DESC);
CREATE INDEX idx_schedule_validations_is_valid ON schedule_validations(is_valid);

-- Add comments
COMMENT ON TABLE schedule_validations IS 'Audit history of schedule validation runs';
COMMENT ON COLUMN schedule_validations.conflicts IS 'Array of detected conflict objects';
COMMENT ON COLUMN schedule_validations.conflict_count IS 'Number of conflicts found';
COMMENT ON COLUMN schedule_validations.generation_mode IS 'How schedule was created: manual, random, optimized';
COMMENT ON COLUMN schedule_validations.validation_duration_ms IS 'Time taken to validate in milliseconds';
