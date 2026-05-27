import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { AISettingsClient } from "./client"
import { getAIAdminPageData } from "./data"

export default async function AdminAISettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/sign-in")
  }

  const data = await getAIAdminPageData()

  return <AISettingsClient {...data} />
}
