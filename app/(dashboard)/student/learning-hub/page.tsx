import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import {
  createLearningHubGroup,
  getDiscoverableLearningHubGroups,
  getStudentLearningHub,
  joinLearningHubGroup,
  joinLearningHubGroupByCode,
} from "@/lib/actions/learning-hub"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getUserDisplayName } from "@/lib/display-name"
import { ArrowRight, Compass, Hash, Plus, Users } from "lucide-react"

type HubGroup = {
  id: string
  title: string
  description?: string | null
  joinCode: string
  isDiscoverable?: boolean
  members?: Array<unknown>
  messages?: Array<unknown>
  files?: Array<unknown>
  creator?: {
    fullName?: string | null
    nickname?: string | null
    name?: string | null
  } | null
}

function groupStats(group: HubGroup) {
  return `${group.members?.length ?? 0} members · ${group.messages?.length ?? 0} chats · ${group.files?.length ?? 0} files`
}

export default async function StudentLearningHubPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
    redirect("/sign-in")
  }

  const displayName = getUserDisplayName(session.user)
  const [{ data: hub }, { data: discoverableGroups = [] }] = await Promise.all([
    getStudentLearningHub(),
    getDiscoverableLearningHubGroups(),
  ])
  const groups = (hub?.groups ?? []) as HubGroup[]
  const browseGroups = discoverableGroups as HubGroup[]

  async function createTopicGroupAction(formData: FormData) {
    "use server"

    const result = await createLearningHubGroup(formData)

    if (result.success && result.data) {
      redirect(`/student/learning-hub/${result.data.id}`)
    }

    redirect("/student/learning-hub")
  }

  async function joinByCodeAction(formData: FormData) {
    "use server"

    const result = await joinLearningHubGroupByCode(formData)

    if (result.success && result.data) {
      redirect(`/student/learning-hub/${result.data.id}`)
    }

    redirect("/student/learning-hub")
  }

  async function joinDiscoverableGroupAction(formData: FormData) {
    "use server"

    const groupId = String(formData.get("groupId") ?? "")
    const result = await joinLearningHubGroup(groupId)

    if (result.success && result.data) {
      redirect(`/student/learning-hub/${result.data.id}`)
    }

    redirect("/student/learning-hub")
  }

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <div className="reveal-in flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <Users className="h-4 w-4" />
            Learning Hub
          </div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-balance text-foreground">
            Student-led topic groups.
          </h1>
          <p className="max-w-xl text-sm text-pretty text-muted-foreground">
            Create focused study spaces, join shared topics, and keep chat and
            files together, {displayName}.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/student">
            <Button
              variant="outline"
              className="rounded-xl transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Joined topics</h2>
              <Badge variant="secondary">Student-led</Badge>
            </div>

            {groups.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {groups.map((group) => (
                  <Link
                    key={group.id}
                    href={`/student/learning-hub/${group.id}`}
                  >
                    <Card className="surface-elevated h-full cursor-pointer rounded-2xl border-border/40 transition-[background-color,box-shadow,transform] hover:bg-muted/50">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-base">
                              {group.title}
                            </CardTitle>
                            <CardDescription className="mt-1 line-clamp-2 text-pretty">
                              {group.description ||
                                "A student topic group inside your learning hub."}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="shrink-0">
                            <Hash className="mr-1 h-3 w-3" />
                            {group.joinCode}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between gap-3 pt-0 text-sm text-muted-foreground">
                        <span>{groupStats(group)}</span>
                        <span className="inline-flex items-center gap-1 text-primary">
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                  <h3 className="mt-4 font-medium">No topics joined yet</h3>
                  <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
                    Join a topic below or create one for your study group.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Browse topics</h2>
              <Badge variant="outline">Discoverable</Badge>
            </div>

            {browseGroups.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {browseGroups.map((group) => (
                  <Card
                    key={group.id}
                    className="surface-elevated rounded-2xl border-border/40"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-base">
                            {group.title}
                          </CardTitle>
                          <CardDescription className="mt-1 line-clamp-2 text-pretty">
                            {group.description ||
                              "A student-created study topic."}
                          </CardDescription>
                        </div>
                        <Compass className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3 pt-0 text-sm text-muted-foreground">
                      <span>{groupStats(group)}</span>
                      <form action={joinDiscoverableGroupAction}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <Button size="sm" className="rounded-xl">
                          Join
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Compass className="h-7 w-7 text-muted-foreground/50" />
                  <p className="mt-3 max-w-sm text-sm text-pretty text-muted-foreground">
                    No open topics are waiting right now.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <Card className="surface-elevated rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle>Join with code</CardTitle>
              <CardDescription>
                Paste a code from another student.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={joinByCodeAction} className="space-y-3">
                <Input
                  name="joinCode"
                  placeholder="Enter topic code"
                  autoCapitalize="characters"
                />
                <Button type="submit" className="w-full rounded-xl">
                  Join topic
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="surface-elevated rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle>Create a topic</CardTitle>
              <CardDescription>
                Start a student-led topic group.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createTopicGroupAction} className="space-y-3">
                <Input
                  name="title"
                  placeholder="Topic, e.g. Machine learning exam prep"
                  required
                />
                <textarea
                  name="description"
                  rows={4}
                  className="min-h-24 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                  placeholder="What will this topic group focus on?"
                />
                <label className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    name="private"
                    value="true"
                    className="h-4 w-4 rounded border-border"
                  />
                  Keep this topic private
                </label>
                <Button type="submit" className="w-full rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Create topic
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
