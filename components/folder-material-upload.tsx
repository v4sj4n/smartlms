"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { UploadDropzone } from "@/components/upload-dropzone"
import { Button } from "@/components/ui/button"

type Props = {
  subjectId: string
  folderId: string
  weekNumber: number
}

type UploadedFile = {
  id?: string
  name?: string
}

export function FolderMaterialUpload({
  subjectId,
  folderId,
  weekNumber,
}: Props) {
  const router = useRouter()
  const [uploadedCount, setUploadedCount] = useState(0)

  return (
    <>
      <UploadDropzone
        subjectId={subjectId}
        folderId={folderId}
        weekNumber={weekNumber}
        onUploaded={(file) => {
          const uploaded = file as UploadedFile
          toast.success(
            uploaded.name ? `${uploaded.name} uploaded` : "File uploaded"
          )
          setUploadedCount((c) => c + 1)
          router.refresh()
        }}
      />

      <div className="mt-4 flex justify-end">
        <Button
          disabled={uploadedCount === 0}
          onClick={() => router.push(`/professor/courses/${subjectId}`)}
        >
          Done uploading
        </Button>
      </div>
    </>
  )
}
