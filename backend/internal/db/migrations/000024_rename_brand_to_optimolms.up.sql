-- 000024: carry the OptimoLMS rename into databases that already exist.
--
-- The rename touched code, seeds and earlier migrations, but a database that has
-- already run those migrations keeps the old rows: the built-in MCP server is
-- still keyed 'smartlms' (so the assistant tab no longer matches it), and the
-- demo accounts are still on @smartlms.dev / @people.smartlms.dev, which the
-- login page and the people seed both look for under the new domain. Rewriting
-- the rows here keeps an existing database identical to a fresh one.

UPDATE mcp_apps
SET key         = 'optimolms',
    name        = 'OptimoLMS',
    description = 'Create courses, weeks, lectures, assignments, quizzes, flashcards and forum threads right here in OptimoLMS.',
    glyph       = 'OL'
WHERE key = 'smartlms';

UPDATE users
SET email = replace(email, '@smartlms.dev', '@optimolms.dev')
WHERE email LIKE '%@smartlms.dev';

UPDATE users
SET email = replace(email, '@people.smartlms.dev', '@people.optimolms.dev')
WHERE email LIKE '%@people.smartlms.dev';
