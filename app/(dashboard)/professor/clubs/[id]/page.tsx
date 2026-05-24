import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import { getClubById } from "@/lib/actions/clubs"
import { UploadDropzone } from "@/components/upload-dropzone"
import { ClubChatPanel } from "@/components/club-chat-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, FileUp, MessageSquare } from "lucide-react"

type ClubMaterial = {
  id: string
  title: string
  type: string
  createdAt: Date | string
  uploader?: {
    name?: string | null
    fullName?: string | null
    nickname?: string | null
  } | null
}

type ClubDetail = {
  id: string
  name: string
  description?: string | null
  materials?: ClubMaterial[]
}

export default async function ProfessorClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "PROFESSOR") {
    redirect("/sign-in")
  }

  const { id } = await params
  const result = await getClubById(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const club = result.data as ClubDetail

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{club.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {club.description || "Faculty monitoring space for this club."}
          </p>
        </div>
        <Link href="/professor/clubs">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clubs
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileUp className="h-4 w-4" />
              Upload material
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UploadDropzone clubId={club.id} />

            <div className="space-y-2">
              <p className="text-sm font-medium">Recent materials</p>
              {club.materials?.length ? (
                <div className="space-y-2">
                  {club.materials.slice(0, 5).map((material) => (
                    <div
                      key={material.id}
                      className="rounded-lg border border-border/60 px-3 py-2 text-sm"
                    >
                      <p className="font-medium">{material.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {material.type} • by{" "}
                        {material.uploader?.fullName ||
                          material.uploader?.name ||
                          material.uploader?.nickname ||
                          "Unknown"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No materials yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-4 w-4" />
              Club chat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ClubChatPanel
              clubId={club.id}
              placeholder="Share guidance with this club..."
              emptyMessage="No messages yet."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
