"use client"

import { useEffect, useRef } from "react"
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
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!clubId || !currentUserId) return

    const supabase = createSupabaseBrowserClient()

    const channel = supabase.channel(`club:${clubId}`)

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "club_messages",
        },
        (payload) => {
          console.log("[ClubChatRealtime] Raw INSERT payload:", payload)
          handlersRef.current.onMessageInserted?.(payload)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "club_messages",
          filter: `club_id=eq.${clubId}`,
        },
        (payload) => {
          handlersRef.current.onMessageUpdated?.(payload)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_message_reactions",
        },
        (payload) => {
          handlersRef.current.onReactionChanged?.(payload)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_message_reads",
        },
        (payload) => {
          handlersRef.current.onReadChanged?.(payload)
        }
      )
      .on(
        "broadcast",
        { event: "typing" },
        ({ payload }: { payload: unknown }) => {
          const typed = payload as { userId?: string; isTyping?: boolean }
          if (typed.userId && typeof typed.isTyping === "boolean") {
            handlersRef.current.onTyping?.(typed.userId, typed.isTyping)
          }
        }
      )

    channel.subscribe((status, err) => {
      console.log("[ClubChatRealtime] Subscription status:", status, err)
      if (status === "SUBSCRIBED") {
        console.log("[ClubChatRealtime] Successfully subscribed to club:", clubId)
      }
      if (status === "CHANNEL_ERROR") {
        console.error("[ClubChatRealtime] Channel error:", err)
      }
      if (status === "TIMED_OUT") {
        console.error("[ClubChatRealtime] Connection timed out")
      }
    })

    return () => {
      console.log("[ClubChatRealtime] Unsubscribing from club:", clubId)
      supabase.removeChannel(channel)
    }
  }, [clubId, currentUserId])
}
