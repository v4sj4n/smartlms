import "dotenv/config"
import { PgBoss } from "pg-boss"
import { ingestFileToRag } from "@/lib/rag/ingest"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is required")
}

const boss = new PgBoss(connectionString)

async function start() {
  await boss.start()
  await boss.createQueue("file.ingest")

  await boss.work("file.ingest", async (job: unknown) => {
    const payload = Array.isArray(job)
      ? (job as Array<Record<string, unknown>>)[0]?.data
      : (job as Record<string, unknown>)["data"]

    const fileId =
      typeof payload === "object" && payload !== null && "fileId" in payload
        ? ((payload as Record<string, unknown>)["fileId"] as string | undefined)
        : undefined

    if (!fileId) throw new Error("Missing fileId in job payload")

    await ingestFileToRag(fileId)
    return { success: true }
  })

  console.log("RAG worker running and listening for file.ingest jobs")
}

start().catch((error) => {
  console.error("Failed to start rag worker", error)
  process.exit(1)
})
