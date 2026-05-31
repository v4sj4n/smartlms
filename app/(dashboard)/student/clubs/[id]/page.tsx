import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import { getClubById } from "@/lib/actions/clubs"
import { ClubWorkspace } from "@/components/club-workspace"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

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

export default async function StudentClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            {club.name}
          </h1>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            {club.description ||
              "Teacher-led club space for materials and conversations."}
          </p>
        </div>
        <Link href="/student/clubs" className="self-start sm:self-auto">
          <Button variant="outline" size="sm" className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clubs
          </Button>
        </Link>
      </div>

      <ClubWorkspace
        clubId={club.id}
        materials={(club.materials ?? []) as ClubMaterial[]}
        chatPlaceholder="Write a message to your club..."
        chatEmptyMessage="No messages yet. Start the conversation."
        materialsTitle="Recent materials"
      />
    </div>
  )
}
