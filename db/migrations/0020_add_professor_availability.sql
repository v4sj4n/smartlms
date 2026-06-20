-- Add professor availability fields to users table
ALTER TABLE users
  ADD COLUMN availability jsonb DEFAULT NULL,
  ADD COLUMN max_weekly_hours integer DEFAULT 20,
  ADD COLUMN preferred_time_slots jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.availability IS 'Weekly availability slots: [{dayOfWeek, startTime, endTime}]';
COMMENT ON COLUMN users.max_weekly_hours IS 'Maximum teaching hours per week';
COMMENT ON COLUMN users.preferred_time_slots IS 'Preferred teaching time preferences: [{dayOfWeek, startTime, endTime, priority}]';
