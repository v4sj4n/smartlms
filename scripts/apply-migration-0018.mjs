import "dotenv/config";
import postgres from "postgres";
import fs from "fs";
import path from "path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

const migrationPath = path.join(process.cwd(), "db/migrations/0018_assignments_and_submissions.sql");
const content = fs.readFileSync(migrationPath, "utf-8");

const statements = content
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`Applying ${statements.length} statements...\n`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  try {
    await sql.unsafe(stmt);
    console.log(`✓ Statement ${i + 1}/${statements.length}`);
  } catch (err) {
    if (err.message.includes("already exists") || err.code === "42710") {
      console.log(`⊘ Statement ${i + 1} already exists, skipping`);
    } else {
      console.error(`✗ Statement ${i + 1} failed:`, err.message);
    }
  }
}

await sql.end();
console.log("\n✅ Migration complete!");
