"use client"

import { useActionState } from "react"

import {
  updateOwnProfileSettings,
  type UpdateProfileSettingsState,
} from "@/lib/actions/profile"
import { Button } from "@/components/ui/button"
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

type ProfileSettingsFormProps = {
  user: {
    name: string | null
    email: string
    image: string | null
    nickname: string | null
    bio: string | null
  }
}

const initialState: UpdateProfileSettingsState = {
  success: false,
  message: "",
}

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateOwnProfileSettings,
    initialState
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Students and professors can update only profile image, nickname, and
          bio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
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

          <div className="space-y-2">
            <Label htmlFor="image">Profile Image URL</Label>
            <Input
              id="image"
              name="image"
              type="url"
              defaultValue={user.image ?? ""}
              placeholder="https://example.com/avatar.jpg"
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

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
