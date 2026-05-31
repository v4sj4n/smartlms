"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

export function AIComingSoonToast() {
  const searchParams = useSearchParams()
  const source = searchParams.get("source")

  useEffect(() => {
    if (source === "ai") {
      toast.info("AI assignment creation is coming soon! Using general assignment creation for now.")
    } else if (source === "quiz") {
      toast.info("Quiz-based assignment creation is coming soon! Using general assignment creation for now.")
    }
  }, [source])

  return null
}
