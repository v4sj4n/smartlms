import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { getProfileSettingsUserById } from "@/lib/data/profile-settings"
import { AIPersonalizationsForm } from "@/components/ai-personalizations-form"

export default async function StudentAISettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
    redirect("/sign-in")
  }

  const user = await getProfileSettingsUserById(session.user.id)

  if (!user) {
    redirect("/sign-in")
  }

  return <AIPersonalizationsForm user={user} />
}
