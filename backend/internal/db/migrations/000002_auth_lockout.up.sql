-- 000002: per-role login lockout
-- roles.max_login_attempts: NULL (empty) = unlimited attempts; otherwise the
-- account is locked for roles.lock_minutes after that many failed logins.

ALTER TABLE roles ADD COLUMN max_login_attempts INTEGER; -- NULL = unlimited
ALTER TABLE roles ADD COLUMN lock_minutes INTEGER NOT NULL DEFAULT 15;

ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT; -- RFC3339, NULL = not locked
