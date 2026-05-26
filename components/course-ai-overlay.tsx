"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import ReactMarkdown from "react-markdown"
import { useChat } from "@ai-sdk/react"
import { TextStreamChatTransport, type UIMessage } from "ai"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import "katex/dist/katex.min.css"
import { Bot, Loader2, SendHorizontal, Sparkles, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

type CourseAiOverlayProps = {
  courseTitle: string
  conversationId?: string | null
  chatbotId?: string | null
  initialMessages?: ChatMessage[]
  model?: string
  systemInstructions?: string
}

const EMPTY_MESSAGES: ChatMessage[] = []

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 last:mb-0">{children}</p>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary underline underline-offset-4"
    >
      {children}
    </a>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-3 border-l-2 border-border pl-4 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-2xl border border-border text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead>{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => <tr>{children}</tr>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border-b border-border bg-muted/60 px-3 py-2 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-b border-border px-3 py-2 align-top last:border-b-0">
      {children}
    </td>
  ),
  hr: () => <hr className="my-4 border-border/70" />,
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-3 text-base font-semibold tracking-tight last:mb-0">
      {children}
    </h3>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-3 text-base font-semibold tracking-tight last:mb-0">
      {children}
    </h3>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-3 text-sm font-semibold tracking-tight last:mb-0">
      {children}
    </h4>
  ),
  code: ({
    inline,
    children,
  }: {
    inline?: boolean
    children?: React.ReactNode
  }) =>
    inline ? (
      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
        {children}
      </code>
    ) : (
      <code className="block overflow-x-auto rounded-2xl bg-muted px-4 py-3 font-mono text-xs leading-6 text-foreground">
        {children}
      </code>
    ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-3 overflow-x-auto rounded-2xl bg-muted px-4 py-3 last:mb-0">
      {children}
    </pre>
  ),
}

const SAMPLE_QUESTIONS = [
  "What are the main takeaways from the latest lecture?",
  "Can you quiz me on this chapter one question at a time?",
  "Explain the hardest concept with a simple example.",
]

function toUiMessage(message: ChatMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.content
      ? [
          {
            type: "text",
            text: message.content,
            state: "done",
          },
        ]
      : [],
  }
}

function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

function normalizeLatex(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${inner}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => `$${inner}$`)
}

function getLatestUserText(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role === "user") {
      return getMessageText(message).trim()
    }
  }
  return ""
}

export function CourseAiOverlay({
  courseTitle,
  conversationId,
  chatbotId,
  initialMessages = EMPTY_MESSAGES,
  model,
  systemInstructions,
}: CourseAiOverlayProps) {
  const [input, setInput] = useState("")
  const [isMounted, setIsMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const canChat = Boolean(conversationId && chatbotId)
  const initialUiMessages = useMemo(
    () => initialMessages.map(toUiMessage),
    [initialMessages]
  )

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/ai/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            conversationId,
            message: getLatestUserText(messages),
            model,
            systemInstructions,
          },
        }),
      }),
    [conversationId, model, systemInstructions]
  )

  const {
    messages,
    status,
    error,
    setMessages,
    sendMessage,
    stop,
    regenerate,
    clearError,
  } = useChat<UIMessage>({
    id: conversationId ?? undefined,
    messages: initialUiMessages,
    transport,
  })

  const isBusy = status === "submitted" || status === "streaming"
  const latestMessageId = messages[messages.length - 1]?.id

  // SSR safety — only render the portal after hydration.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsMounted(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  // Reset messages and input when the conversation changes.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMessages(initialUiMessages)
      setInput("")
      clearError()
    })

    return () => cancelAnimationFrame(frame)
  }, [clearError, initialUiMessages, setMessages, conversationId])

  // Scroll to the latest message whenever messages update.
  useEffect(() => {
    if (!isOpen) return
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isOpen])

  // Focus the input whenever the panel opens (or canChat becomes true).
  useEffect(() => {
    if (!isOpen || !canChat) return
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [isOpen, canChat, status])

  async function handleSend() {
    if (!canChat || isBusy) return
    const trimmed = input.trim()
    if (!trimmed) return

    setInput("")

    try {
      await sendMessage({ text: trimmed })
    } catch {
      setInput(trimmed)
    }
  }

  if (!isMounted) return null

  return createPortal(
    <>
      <Button
        type="button"
        className="fixed right-6 bottom-6 z-2147483647 h-14 w-14 rounded-full bg-primary shadow-[0_16px_40px_rgba(15,23,42,0.35)] transition-transform active:scale-[0.96]"
        size="icon-lg"
        aria-expanded={isOpen}
        aria-label={
          isOpen ? "Close course AI assistant" : "Open course AI assistant"
        }
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {isOpen && (
        <Card
          className={cn(
            "fixed right-6 bottom-24 z-2147483647",
            "flex h-[min(58rem,calc(100vh-5rem))] w-[min(28rem,calc(100vw-1.5rem))] flex-col",
            "overflow-hidden rounded-[1.75rem] border border-border/70",
            "bg-popover/95 shadow-[0_30px_90px_rgba(15,23,42,0.26)] backdrop-blur-xl"
          )}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_100%_0%,rgba(59,130,246,0.18),transparent_42%),radial-gradient(circle_at_0%_0%,rgba(168,85,247,0.12),transparent_35%)]" />

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-start justify-between gap-3 px-4 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-primary shadow-sm">
                  <Bot className="size-5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h2
                    className="truncate text-sm font-semibold tracking-tight"
                    style={{ textWrap: "balance" }}
                  >
                    {courseTitle} AI Assistant
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Course-aware answers, source-grounded hints, and a fast
                    follow-up loop for study sessions.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-full"
                onClick={() => setIsOpen(false)}
                aria-label="Close course AI assistant"
              >
                <span className="text-lg leading-none">×</span>
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1 bg-background/25">
              <div className="flex min-h-full items-center justify-center px-4 py-6">
                {messages.length === 0 ? (
                  <div className="flex w-full max-w-md flex-col items-stretch gap-3 text-center">
                    {SAMPLE_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        className="rounded-full border border-border/70 px-4 py-3 text-sm leading-5 text-foreground transition-[transform,border-color,background-color,opacity] hover:-translate-y-0.5 hover:border-border hover:bg-background/70 hover:opacity-90 active:scale-[0.98]"
                        onClick={() => setInput(question)}
                        disabled={!canChat || isBusy}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    {messages.map((message) => {
                      const text = getMessageText(message)
                      const isAssistant = message.role === "assistant"
                      const isLastMessage = message.id === latestMessageId

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex flex-col gap-1",
                            message.role === "user"
                              ? "items-end"
                              : "items-start"
                          )}
                        >
                          <span className="text-[0.65rem] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                            {isAssistant ? "Assistant" : "You"}
                          </span>
                          <div
                            className={cn(
                              "max-w-[86%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm",
                              isAssistant
                                ? "border border-border/60 bg-background/85 text-foreground"
                                : "bg-primary wrap-break-word whitespace-pre-wrap text-primary-foreground shadow-[0_12px_30px_rgba(37,99,235,0.22)]"
                            )}
                          >
                            {isAssistant ? (
                              text ? (
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm, remarkMath]}
                                  rehypePlugins={[rehypeKatex]}
                                  components={markdownComponents}
                                >
                                  {normalizeLatex(text)}
                                </ReactMarkdown>
                              ) : isLastMessage && isBusy ? (
                                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/80">
                                  <Loader2 className="size-3.5 animate-spin" />
                                  Thinking through the course context...
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  ...
                                </span>
                              )
                            ) : (
                              text
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={endRef} />
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-[0.72rem] text-muted-foreground">
                  <span>
                    {canChat
                      ? isBusy
                        ? "Generating a grounded answer..."
                        : "Enter to send, Shift+Enter for a new line."
                      : "AI assistant unavailable for this course."}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/85 px-2.5 py-1 text-[0.65rem] font-medium tracking-[0.18em] text-foreground uppercase shadow-sm">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        canChat && !isBusy ? "bg-emerald-500" : "bg-amber-500"
                      )}
                    />
                    {error
                      ? "Error"
                      : isBusy
                        ? "Streaming"
                        : canChat
                          ? "Ready"
                          : "Off"}
                  </span>
                </div>

                <div className="flex items-end gap-2">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={
                      canChat
                        ? "Ask about a lecture, topic, or file..."
                        : "AI assistant not available"
                    }
                    className="min-h-24 resize-none rounded-2xl border-border/70 bg-background/90 px-4 py-3 shadow-sm"
                    disabled={!canChat}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        void handleSend()
                      }
                    }}
                  />

                  {isBusy ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-11 w-11 rounded-2xl active:scale-[0.96]"
                      onClick={() => void stop()}
                      aria-label="Stop generating"
                    >
                      <Square className="size-4" />
                    </Button>
                  ) : error ? (
                    <Button
                      type="button"
                      size="icon"
                      className="h-11 w-11 rounded-2xl active:scale-[0.96]"
                      onClick={() => void regenerate()}
                      aria-label="Retry response"
                    >
                      <SendHorizontal className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      className="h-11 w-11 rounded-2xl active:scale-[0.96]"
                      onClick={() => void handleSend()}
                      disabled={!canChat || input.trim().length === 0}
                      aria-label="Send message"
                    >
                      <SendHorizontal className="size-4" />
                    </Button>
                  )}
                </div>

                {error && (
                  <p className="text-xs leading-5 text-destructive">
                    {error.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </>,
    document.body
  )
}
