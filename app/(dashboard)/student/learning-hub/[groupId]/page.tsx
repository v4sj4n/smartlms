import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import {
  createLearningHubMessage,
  getStudentLearningHubGroup,
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
import { UploadDropzone } from "@/components/upload-dropzone"
import { ArrowLeft, FileText, Hash, MessageSquare, Users } from "lucide-react"

export default async function StudentLearningHubGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
    redirect("/sign-in")
  }

  const resolvedParams = await params
  const { data: group } = await getStudentLearningHubGroup(
    resolvedParams.groupId
  )

  if (!group) {
    redirect("/student/learning-hub")
  }

  async function sendMessageAction(formData: FormData) {
    "use server"

    await createLearningHubMessage(formData)
    redirect(`/student/learning-hub/${resolvedParams.groupId}`)
  }

  const memberCount = group.members?.length ?? 0
  const fileCount = group.files?.length ?? 0
  const messageCount = group.messages?.length ?? 0

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <div className="reveal-in flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <Link
            href="/student/learning-hub"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Learning Hub
          </Link>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-balance text-foreground">
            {group.title}
          </h1>
          <p className="max-w-xl text-sm text-pretty text-muted-foreground">
            {group.description || "Student-led topic chat and files live here."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant={group.isDiscoverable ? "secondary" : "outline"}
            className="w-fit"
          >
            {group.isDiscoverable ? "Discoverable" : "Private"}
          </Badge>
          <Badge variant="outline" className="w-fit">
            <Hash className="mr-1 h-3 w-3" />
            Code {group.joinCode}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="surface-elevated rounded-2xl border-border/40">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Members
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {memberCount}
              </p>
            </div>
            <Users className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="surface-elevated rounded-2xl border-border/40">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Messages
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {messageCount}
              </p>
            </div>
            <MessageSquare className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="surface-elevated rounded-2xl border-border/40">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Files
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {fileCount}
              </p>
            </div>
            <FileText className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card className="surface-elevated rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle>Topic chat</CardTitle>
              <CardDescription>
                Talk with this student group and keep the thread focused.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-105 space-y-3 overflow-y-auto pr-1">
                {group.messages?.length ? (
                  group.messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-2xl border border-border/40 bg-muted/20 px-4 py-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                          {message.author?.fullName ||
                            message.author?.nickname ||
                            "Member"}
                        </span>
                        <span>
                          {new Date(message.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-pretty text-foreground">
                        {message.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/40 px-4 py-10 text-center text-sm text-muted-foreground">
                    No messages yet. Start the conversation.
                  </div>
                )}
              </div>

              <form action={sendMessageAction} className="space-y-3">
                <input type="hidden" name="groupId" value={group.id} />
                <textarea
                  name="content"
                  rows={4}
                  className="min-h-24 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                  placeholder="Write a message to the group..."
                />
                <Button type="submit" className="rounded-xl">
                  Send message
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="surface-elevated rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle>Send files</CardTitle>
              <CardDescription>
                Share documents and study files with everyone in the topic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadDropzone learningHubGroupId={group.id} />
            </CardContent>
          </Card>

          <Card className="surface-elevated rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle>Shared files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.files?.length ? (
                group.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {file.uploadedBy ? "Uploaded by a member" : "Uploaded"}
                      </p>
                    </div>
                    <Badge variant="outline">Shared</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No files yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
