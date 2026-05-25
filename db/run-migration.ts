import { db } from "./index"
import { sql } from "drizzle-orm"
import fs from "fs"
import path from "path"

async function main() {
  console.log("🛠️ Reading SQL migration file...")
  const migrationDir = path.join(process.cwd(), "db", "migrations")
  const requestedFile = process.argv[2]

  if (!fs.existsSync(migrationDir)) {
    console.error("❌ Migrations directory does not exist!")
    process.exit(1)
  }

  let files = fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql"))

  if (files.length === 0) {
    console.error("❌ No SQL migration files found!")
    process.exit(1)
  }

  // Sort files to apply in correct order
  files.sort()

  // Optional: apply only a single migration file
  if (requestedFile) {
    if (!files.includes(requestedFile)) {
      console.error(`❌ Migration file not found: ${requestedFile}`)
      process.exit(1)
    }
    files = [requestedFile]
  }

  for (const file of files) {
    console.log(`📦 Applying migration: ${file}`)
    const filePath = path.join(migrationDir, file)
    const sqlContent = fs.readFileSync(filePath, "utf-8")

    // Split by Drizzle's statement-breakpoint comment
    const statements = sqlContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      console.log(`⚡ Statement ${i + 1}/${statements.length}...`)
      try {
        await db.execute(sql.raw(stmt))
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : String(err)
        console.error(`❌ Statement failed!`)
        console.error(`Query: ${stmt}`)
        console.error(`Error:`, errorMessage)
        process.exit(1)
      }
    }
  }

  console.log("🚀 Custom migration completed successfully!")
  process.exit(0)
}

main().catch((err) => {
  console.error("❌ Migration failed:", err)
  process.exit(1)
})
