"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  subjectId?: string
  folderId?: string
  weekNumber?: number
  clubId?: string
  onUploaded?: (file: unknown) => void
}

type UploadState = {
  progress: number
  name: string
  status: "idle" | "uploading" | "done" | "error"
  error?: string
}

export function UploadDropzone(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>({
    progress: 0,
    name: "",
    status: "idle",
  })

  async function uploadFile(file: File) {
    setState({ progress: 0, name: file.name, status: "uploading" })

    const signedRes = await fetch("/api/uploads/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        subjectId: props.subjectId,
        folderId: props.folderId,
        weekNumber: props.weekNumber,
        clubId: props.clubId,
      }),
    })

    if (!signedRes.ok) {
      const body = await signedRes.json()
      throw new Error(body.error ?? "Failed to get signed upload URL")
    }

    const signed = (await signedRes.json()) as {
      signedUrl: string
      path: string
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", signed.signedUrl, true)
      xhr.setRequestHeader("Content-Type", file.type)

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        const progress = Math.round((event.loaded / event.total) * 100)
        setState((prev) => ({ ...prev, progress }))
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Upload failed (${xhr.status})`))
        }
      }

      xhr.onerror = () => reject(new Error("Upload network error"))
      xhr.send(file)
    })

    const finalizeRes = await fetch("/api/uploads/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        path: signed.path,
        subjectId: props.subjectId,
        folderId: props.folderId,
        weekNumber: props.weekNumber,
        clubId: props.clubId,
      }),
    })

    if (!finalizeRes.ok) {
      const body = await finalizeRes.json()
      throw new Error(body.error ?? "Failed to finalize upload")
    }

    const saved = await finalizeRes.json()
    setState({ progress: 100, name: file.name, status: "done" })
    props.onUploaded?.(saved)
  }

  async function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return

    try {
      await uploadFile(file)
    } catch (error) {
      setState({
        progress: 0,
        name: file.name,
        status: "error",
        error: error instanceof Error ? error.message : "Upload failed",
      })
    }
  }

  return (
    <div
      className={cn(
        "w-full rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center",
        "transition hover:bg-muted/40"
      )}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <p className="text-sm font-medium">Drop file here or click to upload</p>
      <p className="mt-1 text-xs text-muted-foreground">
        PDF, DOCX, PPTX, TXT, PNG, JPG, WEBP (max 30MB)
      </p>

      {state.status !== "idle" && (
        <div className="mt-4 space-y-1">
          <p className="text-sm">{state.name}</p>
          <div className="h-2 w-full rounded bg-muted">
            <div
              className="h-2 rounded bg-primary"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          {state.status === "error" && (
            <p className="text-xs text-destructive">{state.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
