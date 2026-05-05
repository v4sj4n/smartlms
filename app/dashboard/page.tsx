import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/sign-in")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-4xl font-bold">Dashboard</h1>
      <p className="text-xl">
        Welcome, {session.user.name || session.user.email}!
      </p>
      <p className="text-muted-foreground">Role: {session.user.role}</p>
      <Button asChild>
        <Link href="/api/auth/signout">Sign Out</Link>
      </Button>
    </div>
  )
}
