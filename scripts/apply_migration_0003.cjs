/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const fs = require('fs');
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
(async () => {
  try {
    const content = fs.readFileSync('db/migrations/0003_red_captain_america.sql', 'utf8');
    const statements = content.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      console.log('Running statement:', stmt.slice(0, 120).replace(/\n/g, ' '), '...');
      try {
        await sql.unsafe(stmt);
        console.log('OK');
      } catch (e) {
        console.error('Statement error:', e.message || e);
      }
    }
  } catch (e) {
    console.error('Fatal error:', e.message || e);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();
