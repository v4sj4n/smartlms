"use client"

import { useEffect } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type RealtimeHandlers = {
  onMessageInserted?: (payload: unknown) => void
  onMessageUpdated?: (payload: unknown) => void
  onReactionChanged?: (payload: unknown) => void
  onReadChanged?: (payload: unknown) => void
  onTyping?: (userId: string, isTyping: boolean) => void
  onPresence?: (onlineUserIds: string[]) => void
}

export function useClubChatRealtime(
  clubId: string,
  currentUserId: string,
  handlers: RealtimeHandlers
) {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    const channel = supabase.channel(`club:${clubId}`, {
      config: { presence: { key: crypto.randomUUID() } },
    })

      const realtimeChannel = channel

    realtimeChannel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "club_messages",
          filter: `club_id=eq.${clubId}`,
        },
        handlers.onMessageInserted
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "club_messages",
          filter: `club_id=eq.${clubId}`,
        },
        handlers.onMessageUpdated
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_message_reactions",
        },
        handlers.onReactionChanged
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_message_reads",
        },
        handlers.onReadChanged
      )
      .on("broadcast", { event: "typing" }, ({ payload }: { payload: unknown }) => {
        const typed = payload as { userId?: string; isTyping?: boolean }
        if (typed.userId && typeof typed.isTyping === "boolean") {
          handlers.onTyping?.(typed.userId, typed.isTyping)
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: string }>()
        const onlineUserIds = Object.values(state)
          .flat()
          .map((entry) => entry.userId)
          .filter(Boolean)

        handlers.onPresence?.([...new Set(onlineUserIds)])
      })

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId: currentUserId })
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clubId, currentUserId, handlers])
}
