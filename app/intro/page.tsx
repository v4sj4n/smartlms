import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VideoPlayer } from "@/components/video-player"

export const metadata: Metadata = {
  title: "Introduction - OptimoLMS",
  description:
    "Watch our introduction video to learn more about OptimoLMS and its features.",
}

export default function IntroPage() {
  return (
    <main className="flex min-h-svh flex-col bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8">
        <div className="mb-8">
          <Button
            asChild
            variant="ghost"
            className="-ml-4 gap-2 text-muted-foreground hover:text-foreground"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
            See Optimo in Action
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
            Watch our introduction video with Albanian subtitles to learn more about the platform.
          </p>
        </div>

        <VideoPlayer />
      </div>
    </main>
  )
}
