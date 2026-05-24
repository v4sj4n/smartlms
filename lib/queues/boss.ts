import { PgBoss } from "pg-boss"
import { env } from "@/lib/env"

let boss: PgBoss | null = null

export async function getBoss() {
  if (!boss) {
    boss = new PgBoss(env.DATABASE_URL)
    await boss.start()
    await boss.createQueue("file.ingest")
  }

  return boss
}
