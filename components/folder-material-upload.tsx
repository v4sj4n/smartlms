"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { UploadDropzone } from "@/components/upload-dropzone"

type Props = {
  subjectId: string
  weekNumber: number
}

type UploadedFile = {
  id?: string
  name?: string
}

export function FolderMaterialUpload({ subjectId, weekNumber }: Props) {
  const router = useRouter()

  return (
    <UploadDropzone
      subjectId={subjectId}
      weekNumber={weekNumber}
      onUploaded={(file) => {
        const uploaded = file as UploadedFile
        toast.success(
          uploaded.name ? `${uploaded.name} uploaded` : "File uploaded"
        )
        router.refresh()
      }}
    />
  )
}
