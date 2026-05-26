"use client"

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Image as ImageIcon, Loader2, Save, UploadCloud } from "lucide-react"

import {
  updateOwnProfileSettings,
  type UpdateProfileSettingsState,
} from "@/lib/actions/profile"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getUserDisplayName } from "@/lib/display-name"

type ProfileSettingsFormProps = {
  user: {
    name: string | null
    email: string
    image: string | null
    imageUrl: string | null
    nickname: string | null
    bio: string | null
  }
}

const initialState: UpdateProfileSettingsState = {
  success: false,
  message: "",
}

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const displayName = getUserDisplayName(user)
  const router = useRouter()
  const { update } = useSession()
  const handledSuccessRef = useRef(false)
  const [state, formAction, isPending] = useActionState(
    updateOwnProfileSettings,
    initialState
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageValue, setImageValue] = useState(user.image ?? "")
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.imageUrl)
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "ready" | "error"
  >("idle")
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (isPending) {
      handledSuccessRef.current = false
      return
    }

    if (!state.success || handledSuccessRef.current) {
      return
    }

    handledSuccessRef.current = true
    void update()
    router.refresh()
  }, [isPending, router, state.success, update])

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  async function uploadProfileImage(file: File) {
    setUploadState("uploading")
    setUploadError(null)

    try {
      const signedRes = await fetch("/api/uploads/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          size: file.size,
          profileImage: true,
        }),
      })

      if (!signedRes.ok) {
        const body = await signedRes.json()
        throw new Error(body.error ?? "Failed to prepare image upload")
      }

      const signed = (await signedRes.json()) as {
        signedUrl: string
        path: string
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", signed.signedUrl, true)
        xhr.setRequestHeader("Content-Type", file.type)

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

      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl)
      }

      setImageValue(signed.path)
      setPreviewUrl(URL.createObjectURL(file))
      setUploadState("ready")
    } catch (error) {
      setUploadState("error")
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload image"
      )
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setUploadState("error")
      setUploadError("Please choose an image file.")
      return
    }

    void uploadProfileImage(file)
    event.target.value = ""
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-balance">Profile Settings</CardTitle>
        <CardDescription className="text-pretty">
          Students, professors, and admins can update only profile image,
          nickname, and bio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="image" value={imageValue} />

          <div className="space-y-3">
            <Label htmlFor="profile-image">Profile Image</Label>
            <div className="flex w-full flex-row items-center gap-4 rounded-2xl bg-muted/20 p-4 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.06)]">
              <Avatar className="h-20 w-20 shrink-0 border border-border/60 shadow-sm">
                <AvatarImage
                  src={previewUrl ?? undefined}
                  alt={displayName || "Profile image"}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/10 text-primary">
                  <span className="flex aspect-square h-10 w-10 items-center justify-center rounded-xl bg-background/90 shadow-sm ring-1 ring-border/60">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Upload a new avatar</p>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG, or WEBP up to 30 MB. Uploading replaces your
                    current profile image.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    id="profile-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadState === "uploading"}
                    className="transition-transform active:scale-[0.96]"
                  >
                    {uploadState === "uploading" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="mr-2 h-4 w-4" />
                    )}
                    {uploadState === "uploading"
                      ? "Uploading..."
                      : "Choose image"}
                  </Button>

                  {previewUrl ? (
                    <p className="text-xs text-muted-foreground">
                      Preview updates before you save.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No avatar selected yet.
                    </p>
                  )}
                </div>

                {uploadError ? (
                  <p className="text-sm text-destructive">{uploadError}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name (locked)</Label>
              <Input id="name" value={user.name ?? ""} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (locked)</Label>
              <Input id="email" value={user.email} disabled readOnly />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              name="nickname"
              defaultValue={user.nickname ?? ""}
              placeholder="How should people call you?"
              maxLength={64}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              defaultValue={user.bio ?? ""}
              placeholder="Tell others a little about yourself"
              maxLength={500}
              rows={5}
            />
          </div>

          {state.message ? (
            <p
              className={
                state.success
                  ? "text-sm text-emerald-600"
                  : "text-sm text-destructive"
              }
            >
              {state.message}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={isPending}
            className="transition-transform active:scale-[0.96]"
          >
            {isPending ? (
              "Saving..."
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save settings
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
