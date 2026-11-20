-- 000018: the built-in OptimoLMS MCP server
--
-- The MCP tab lists servers, and the first one is this backend's own: the tools
-- in internal/handler/mcp_tools.go that create subjects, weeks, lectures,
-- assignments, quizzes, flashcards and forum threads. It is a catalog row like
-- any other app, so connecting it uses the same user_mcp_apps switch the tab
-- already draws — and the chat loop only offers tools to people who connected it.
--
-- Seeding it here rather than in Go keeps the catalogue honest: one row per
-- server, added by the migration that introduced the server.

INSERT OR IGNORE INTO mcp_apps (key, name, description, category, glyph, tone, scopes, created_at)
VALUES (
  'optimolms',
  'OptimoLMS',
  'Create courses, weeks, lectures, assignments, quizzes, flashcards and forum threads right here in OptimoLMS.',
  'Built in',
  'OL',
  'blue',
  '["subjects.manage","lectures.manage","assignments.manage","quizzes.manage","flashcards.manage","forums.post","forums.moderate"]',
  '2026-11-20T00:00:00Z'
);
