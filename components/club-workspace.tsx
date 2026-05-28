"use client"

import { useState } from "react"
import { ClubChatPanel } from "@/components/club-chat-panel"
import { UploadDropzone } from "@/components/upload-dropzone"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUp, MessageSquare } from "lucide-react"

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

type ClubWorkspaceProps = {
  clubId: string
  materials: ClubMaterial[]
  chatPlaceholder: string
  chatEmptyMessage: string
  materialsTitle?: string
}

export function ClubWorkspace({
  clubId,
  materials,
  chatPlaceholder,
  chatEmptyMessage,
  materialsTitle = "Recent materials",
}: ClubWorkspaceProps) {
  const [localMaterials, setLocalMaterials] = useState(materials)

  return (
    <Tabs defaultValue="chat" className="flex flex-col">
      <TabsList className="self-start">
        <TabsTrigger value="chat" className="gap-1.5">
          <MessageSquare className="h-4 w-4" />
          Chat
        </TabsTrigger>
        <TabsTrigger value="files" className="gap-1.5">
          <FileUp className="h-4 w-4" />
          Files
        </TabsTrigger>
      </TabsList>

      <TabsContent value="chat" className="mt-4">
        <ClubChatPanel
          clubId={clubId}
          placeholder={chatPlaceholder}
          emptyMessage={chatEmptyMessage}
        />
      </TabsContent>

      <TabsContent value="files" className="mt-4 space-y-4">
        <UploadDropzone
          clubId={clubId}
          onUploaded={(file) => {
            const f = file as ClubMaterial
            setLocalMaterials((prev) => [f, ...prev])
          }}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium">{materialsTitle}</p>
          {localMaterials.length ? (
            <div className="space-y-2">
              {localMaterials.slice(0, 10).map((material) => (
                <div
                  key={material.id}
                  className="rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <p className="font-medium">{material.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {material.type} &bull; by{" "}
                    {material.uploader?.fullName ||
                      material.uploader?.name ||
                      material.uploader?.nickname ||
                      "Unknown"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No materials yet.</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
