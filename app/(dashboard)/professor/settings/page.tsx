import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { getProfileSettingsUserById } from "@/lib/data/profile-settings"
import { ProfileSettingsForm } from "@/components/profile-settings-form"

export default async function ProfessorSettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "PROFESSOR") {
    redirect("/sign-in")
  }

  const user = await getProfileSettingsUserById(session.user.id)

  if (!user) {
    redirect("/sign-in")
  }

  return <ProfileSettingsForm user={user} />
}
