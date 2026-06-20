import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { getProfileSettingsUserById } from "@/lib/data/profile-settings"
import { ProfileSettingsForm } from "@/components/profile-settings-form"
import { ProfessorAvailabilityForm } from "@/components/professor/availability-form"
import { getProfessorAvailability } from "@/lib/actions/professor-availability"

export default async function ProfessorSettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "PROFESSOR") {
    redirect("/sign-in")
  }

  const user = await getProfileSettingsUserById(session.user.id)

  if (!user) {
    redirect("/sign-in")
  }

  const availability = await getProfessorAvailability(session.user.id)

  return (
    <div className="space-y-6">
      <ProfileSettingsForm user={user} />
      <ProfessorAvailabilityForm
        professorId={session.user.id}
        initialAvailability={availability.data?.availability ?? []}
        initialMaxHours={availability.data?.maxWeeklyHours ?? 20}
      />
    </div>
  )
}
