import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getAISettings } from "@/lib/data/ai-settings"
import { AISettingsForm } from "@/components/ai-settings-form"

export default async function AISettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/sign-in")
  }

  const settings = await getAISettings()

  // Use defaults if no settings exist
  const defaultSettings = {
    chatProvider: "google",
    chatModelId: "gemini-2.0-flash-001",
    chatApiKey: null,
    chatBaseUrl: null,
    chatTemperature: "0.7",
    chatMaxTokens: 4096,
    embeddingProvider: "google",
    embeddingModelId: "gemini-embedding-001",
    embeddingApiKey: null,
    embeddingBaseUrl: null,
    embeddingDimensions: 768,
    isEnabled: true,
    allowFileUploads: true,
  }

  const formSettings = settings ?? defaultSettings

  return (
    <div className="mx-auto max-w-3xl">
      <AISettingsForm settings={formSettings} />
    </div>
  )
}
