import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export default async function DashboardRedirectPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/sign-in")
  }

  // Redirect based on role
  switch (session.user.role) {
    case "ADMIN":
      redirect("/admin")
    case "PROFESSOR":
      redirect("/professor")
    case "STUDENT":
      redirect("/student")
    default:
      redirect("/sign-in")
  }
}
