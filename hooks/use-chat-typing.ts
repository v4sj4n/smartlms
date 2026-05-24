"use client"

import { useMemo } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export function useChatTyping(clubId: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  return {
    sendTyping: async (userId: string, isTyping: boolean) => {
      const channel = supabase.channel(`club:${clubId}`)
      await channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, isTyping },
      })
      supabase.removeChannel(channel)
    },
  }
}
