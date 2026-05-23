require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
(async () => {
  try {
    const migs = await sql`select id, name, status, created_at from __drizzle_migrations order by id`;
    console.log('migrations:', migs);
  } catch (e) {
    console.error('migrations error:', e.message || e);
  }
  try {
    const tables = await sql`select tablename from pg_catalog.pg_tables where tablename='lecture_materials'`;
    console.log('lecture_materials:', tables);
  } catch (e) {
    console.error('tables error:', e.message || e);
  }
  await sql.end();
})();
