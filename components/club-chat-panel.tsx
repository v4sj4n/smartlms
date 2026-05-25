"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { getClubMessagesPage, sendClubMessage } from "@/lib/actions/club-chat"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ClubChatMessage = {
  id: string
  content: string
  createdAt: Date | string
  author?: {
    id?: string
    fullName?: string | null
    nickname?: string | null
  } | null
}

type ClubChatPanelProps = {
  clubId: string
  placeholder: string
  emptyMessage: string
}

export function ClubChatPanel({
  clubId,
  placeholder,
  emptyMessage,
}: ClubChatPanelProps) {
  const [messages, setMessages] = useState<ClubChatMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [content, setContent] = useState("")
  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)

  const hasMore = useMemo(() => nextCursor !== null, [nextCursor])

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || isLoadingOlder || !nextCursor) return

    const el = listRef.current
    const previousHeight = el?.scrollHeight ?? 0
    const previousTop = el?.scrollTop ?? 0

    setIsLoadingOlder(true)
    try {
      const page = await getClubMessagesPage({
        clubId,
        cursorCreatedAt: nextCursor,
        limit: 10,
      })

      setMessages((prev) => [...(page.items as ClubChatMessage[]), ...prev])
      setNextCursor(page.nextCursor)

      requestAnimationFrame(() => {
        const current = listRef.current
        if (!current) return
        const newHeight = current.scrollHeight
        current.scrollTop = newHeight - previousHeight + previousTop
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load older messages"
      )
    } finally {
      setIsLoadingOlder(false)
    }
  }, [clubId, hasMore, isLoadingOlder, nextCursor])

  useEffect(() => {
    let isMounted = true

    const loadInitialMessages = async () => {
      try {
        const page = await getClubMessagesPage({ clubId, limit: 10 })
        if (!isMounted) return

        setMessages(page.items as ClubChatMessage[])
        setNextCursor(page.nextCursor)

        requestAnimationFrame(() => {
          scrollToBottom()
        })
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load messages"
        )
      } finally {
        if (isMounted) {
          setIsLoadingInitial(false)
        }
      }
    }

    void loadInitialMessages()

    return () => {
      isMounted = false
    }
  }, [clubId, scrollToBottom])

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el || !hasMore || isLoadingOlder) return

    if (el.scrollTop <= 72) {
      void loadOlderMessages()
    }
  }, [hasMore, isLoadingOlder, loadOlderMessages])

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || isSending) return

    setIsSending(true)
    try {
      const message = await sendClubMessage({ clubId, content: trimmed })
      setMessages((prev) => [...prev, message as ClubChatMessage])
      setContent("")

      requestAnimationFrame(() => {
        scrollToBottom()
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      )
    } finally {
      setIsSending(false)
    }
  }, [clubId, content, isSending, scrollToBottom])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={placeholder}
          required
        />
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={isSending}
          >
            {isSending ? "Sending..." : "Send message"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Recent messages</p>
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="max-h-90 space-y-2 overflow-y-auto pr-1"
        >
          {isLoadingInitial ? (
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <>
              {isLoadingOlder && (
                <p className="pb-1 text-center text-xs text-muted-foreground">
                  Loading older messages...
                </p>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {message.author?.fullName ||
                        message.author?.nickname ||
                        "Member"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-foreground/90">
                    {message.content}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
