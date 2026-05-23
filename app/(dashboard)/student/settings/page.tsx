import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { getProfileSettingsUserById } from "@/lib/data/profile-settings"
import { ProfileSettingsForm } from "@/components/profile-settings-form"

export default async function StudentSettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
    redirect("/sign-in")
  }

  const user = await getProfileSettingsUserById(session.user.id)

  if (!user) {
    redirect("/sign-in")
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Update your visible profile details.
        </p>
      </div>

      <ProfileSettingsForm user={user} />
    </div>
  )
}
