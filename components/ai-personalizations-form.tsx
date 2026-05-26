"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Save, Sparkles } from "lucide-react"

import {
  updateOwnAIPersonalizations,
  type UpdateAIPersonalizationsState,
} from "@/lib/actions/profile"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type AIPersonalizationsFormProps = {
  user: {
    aiTone: string | null
    aiCustomInstructions: string | null
  }
}

const initialState: UpdateAIPersonalizationsState = {
  success: false,
  message: "",
}

const AI_TONES = [
  "Default",
  "Professional",
  "Friendly",
  "Candid",
  "Quirky",
  "Efficient",
  "Cynical",
] as const

export function AIPersonalizationsForm({ user }: AIPersonalizationsFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(
    updateOwnAIPersonalizations,
    initialState
  )
  const [aiTone, setAiTone] = useState(user.aiTone ?? "Default")

  useEffect(() => {
    if (state.success) {
      router.refresh()
    }
  }, [router, state.success])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-balance">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Personalizations
        </CardTitle>
        <CardDescription className="text-pretty">
          Control how AI responds to you across chat and content generation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="aiTone" value={aiTone} />

          <div className="space-y-2">
            <Label htmlFor="aiTone">Default tone</Label>
            <Select value={aiTone} onValueChange={setAiTone}>
              <SelectTrigger id="aiTone">
                <SelectValue placeholder="Choose a tone" />
              </SelectTrigger>
              <SelectContent>
                {AI_TONES.map((tone) => (
                  <SelectItem key={tone} value={tone}>
                    {tone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default keeps the assistant neutral and direct.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aiCustomInstructions">Custom instructions</Label>
            <Textarea
              id="aiCustomInstructions"
              name="aiCustomInstructions"
              defaultValue={user.aiCustomInstructions ?? ""}
              placeholder="Add custom guidance for how the AI should respond to you"
              maxLength={4000}
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Use this for preferences, formatting, or response style.
            </p>
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
                Save AI personalizations
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
