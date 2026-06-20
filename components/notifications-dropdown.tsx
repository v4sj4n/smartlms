"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationAsRead,
} from "@/lib/actions/notifications"

type NotificationItem = {
  id: string
  title: string
  body: string
  href: string | null
  readAt: Date | null
  createdAt: Date
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isPending, startTransition] = useTransition()

  function loadNotifications() {
    startTransition(async () => {
      const result = await getNotificationsForUser(15)
      if (result.success) {
        setItems(result.data as NotificationItem[])
        setUnreadCount(result.unreadCount)
      }
    })
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  useEffect(() => {
    if (open) {
      loadNotifications()
    }
  }, [open])

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    loadNotifications()
  }

  async function handleItemClick(item: NotificationItem) {
    if (!item.readAt) {
      await markNotificationAsRead(item.id)
      loadNotifications()
    }
    if (item.href) {
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 rounded-full border-border/40"
          aria-label="View Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-2 w-2 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={handleMarkAllRead}
              disabled={isPending}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            items.map((item) => {
              const content = (
                <div
                  className={`border-b px-4 py-3 last:border-0 ${
                    !item.readAt ? "bg-muted/40" : ""
                  }`}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {item.body}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )

              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => handleItemClick(item)}
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  className="block w-full text-left"
                  onClick={() => handleItemClick(item)}
                >
                  {content}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
