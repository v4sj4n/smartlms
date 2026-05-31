import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import { getClubs } from "@/lib/actions/clubs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Compass,
  MessageSquare,
  FileText,
  Users,
  ArrowRight,
  Plus,
} from "lucide-react"

type ClubSummary = {
  id: string
  name: string
  description?: string | null
  members?: unknown[]
  materials?: unknown[]
  messages?: {
    id: string
    content: string
    createdAt: Date | string
    author?: {
      fullName?: string | null
      nickname?: string | null
    } | null
  }[]
}

export default async function AdminClubsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/sign-in")
  }

  const { data } = await getClubs()
  const clubs = (data ?? []) as ClubSummary[]
  const totalMembers = clubs.reduce(
    (sum, club) => sum + (club.members?.length ?? 0),
    0
  )
  const totalMaterials = clubs.reduce(
    (sum, club) => sum + (club.materials?.length ?? 0),
    0
  )
  const totalMessages = clubs.reduce(
    (sum, club) => sum + (club.messages?.length ?? 0),
    0
  )

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <div
        className="reveal-in flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
        style={{ animationDelay: "0ms" }}
      >
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <Compass className="mr-2 h-4 w-4" />
            Clubs
          </div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-balance text-foreground">
            Manage teacher-led clubs.
          </h1>
          <p className="max-w-xl text-sm text-pretty text-muted-foreground">
            View official club spaces, monitor activity, and manage club
            details.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/admin">
            <Button
              variant="outline"
              className="rounded-xl transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              Back to Dashboard
            </Button>
          </Link>
          <Button
            className="rounded-xl transition-transform duration-150 ease-out active:scale-[0.96]"
            disabled
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Group
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="surface-elevated rounded-2xl border-border/40">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Total Groups
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {clubs.length}
              </p>
            </div>
            <Compass className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card className="surface-elevated rounded-2xl border-border/40">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Total Members
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {totalMembers}
              </p>
            </div>
            <Users className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card className="surface-elevated rounded-2xl border-border/40">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Total Activity
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {totalMaterials + totalMessages}
              </p>
            </div>
            <MessageSquare className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      {clubs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clubs.map((club) => (
            <Card
              key={club.id}
              className="surface-elevated reveal-in group flex h-full flex-col rounded-2xl border-border/40 transition-[box-shadow,transform,border-color] hover:border-border/60"
              style={{ animationDelay: "80ms" }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-bold tracking-tight">
                      {club.name}
                    </CardTitle>
                    <CardDescription className="mt-1 line-clamp-2 leading-relaxed text-pretty">
                      {club.description ||
                        "An official club space for events, updates, and shared materials."}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className="shrink-0 rounded-full bg-primary/10 text-primary"
                  >
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="mt-auto space-y-4 pb-5">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
                    <Users className="h-3.5 w-3.5" />
                    {club.members?.length ?? 0} members
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
                    <FileText className="h-3.5 w-3.5" />
                    {club.materials?.length ?? 0} materials
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {club.messages?.length ?? 0} messages
                  </span>
                </div>

                <div className="space-y-2 border-t border-border/40 pt-4 text-sm">
                  {club.messages?.[0] ? (
                    <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <p className="line-clamp-2 text-foreground/90">
                        {club.messages[0].content}
                      </p>
                      <p className="mt-1">
                        Last message by{" "}
                        {club.messages[0].author?.fullName ||
                          club.messages[0].author?.nickname ||
                          "Member"}{" "}
                        •{" "}
                        {new Date(club.messages[0].createdAt).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No messages yet.
                    </p>
                  )}

                  <div className="flex items-center justify-between text-muted-foreground">
                    <Link
                      href={`/admin/clubs/${club.id}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      Manage club
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-3xl border-dashed border-border/50 bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
              <Compass className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-balance">
              No Clubs Available Yet
            </h2>
            <p className="mt-2 max-w-md text-sm text-pretty text-muted-foreground">
              Create groups to foster student communities and collaborative
              activity.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
