-- 000025: accent color and contrast level join theme and font
--
-- accent picks the palette the app paints its primary color with; every
-- accent is generated to pass WCAG contrast (frontend/scripts/accents.mjs).
-- contrast "system" follows the OS (prefers-contrast: more); "high" raises
-- text to 7:1 everywhere.

ALTER TABLE user_appearance ADD COLUMN accent TEXT NOT NULL DEFAULT 'blue';
ALTER TABLE user_appearance ADD COLUMN contrast TEXT NOT NULL DEFAULT 'system';
