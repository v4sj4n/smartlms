import { db } from "./db/index"
import { users, userAuth } from "./db/schema"
async function check() {
  const allUsers = await db.select().from(users)
  console.log("Users:", allUsers)
  const allAuth = await db.select().from(userAuth)
  console.log("Auth:", allAuth)
  process.exit(0)
}
check()
