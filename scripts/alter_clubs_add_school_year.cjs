require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
(async () => {
  try {
    await sql.unsafe('ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "school_year_id" uuid;');
    console.log('Added column school_year_id (if it did not exist)');
    const existing = await sql`select constraint_name from information_schema.table_constraints where table_name = 'clubs' and constraint_type = 'FOREIGN KEY'`;
    const hasConstraint = existing.some(r => String(r.constraint_name).includes('school_year'));
    if (!hasConstraint) {
      await sql.unsafe('ALTER TABLE "clubs" ADD CONSTRAINT "clubs_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE cascade;');
      console.log('Added FK constraint');
    } else {
      console.log('FK constraint already exists');
    }
  } catch (e) {
    console.error('Error altering clubs table:', e.message || e);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();
