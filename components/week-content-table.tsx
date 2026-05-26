"use client"

import * as React from "react"
import { toast } from "sonner"
import { FileText, HelpCircle, Layers } from "lucide-react"
import Link from "next/link"
import { updateWeekContentPublicationState } from "@/lib/actions/content-visibility"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type ContentKind = "material" | "quiz" | "flashcardSet"

type WeekContentItem = {
  id: string
  kind: ContentKind
  title: string
  detail?: string | null
  isPublished: boolean
  memberIds?: string[]
  actionHref?: string | null
  isExternal?: boolean
}

type WeekContentTableProps = {
  weekId: string
  items: WeekContentItem[]
  readOnly?: boolean
}

const kindMeta: Record<
  ContentKind,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  material: { label: "Material", icon: FileText },
  quiz: { label: "Quiz", icon: HelpCircle },
  flashcardSet: { label: "Flashcard Set", icon: Layers },
}

function sortItems(items: WeekContentItem[]) {
  const order: Record<ContentKind, number> = {
    material: 0,
    quiz: 1,
    flashcardSet: 2,
  }

  return [...items].sort((left, right) => {
    if (order[left.kind] !== order[right.kind]) {
      return order[left.kind] - order[right.kind]
    }

    return left.title.localeCompare(right.title)
  })
}

export function WeekContentTable({
  weekId,
  items,
  readOnly,
}: WeekContentTableProps) {
  const router = useRouter()
  const [contentItems, setContentItems] = React.useState(() => sortItems(items))
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [isSaving, setIsSaving] = React.useState(false)

  const selectedCount = selectedIds.length
  const allSelected =
    contentItems.length > 0 && selectedCount === contentItems.length
  const someSelected = selectedCount > 0 && selectedCount < contentItems.length

  function setLocalPublicationState(targetIds: string[], isPublished: boolean) {
    setContentItems((currentItems) =>
      currentItems.map((item) =>
        targetIds.includes(item.id) ? { ...item, isPublished } : item
      )
    )
  }

  function updatePublicationState(targetIds: string[], isPublished: boolean) {
    if (!targetIds.length || isSaving) {
      return
    }

    const snapshot = contentItems
    setLocalPublicationState(targetIds, isPublished)

    setIsSaving(true)
    void (async () => {
      try {
        await updateWeekContentPublicationState({
          weekId,
          items: snapshot
            .filter((item) => targetIds.includes(item.id))
            .map((item) => ({
              id: item.id,
              kind: item.kind,
              memberIds: item.memberIds,
            })),
          isPublished,
        })
        setSelectedIds([])
        // rehydrate server data so professors see the authoritative status
        router.refresh()
        toast.success(
          isPublished ? "Marked as published" : "Marked as not published"
        )
      } catch {
        setContentItems(snapshot)
        toast.error("Failed to update content visibility")
      } finally {
        setIsSaving(false)
      }
    })()
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...current, id]
        : current.filter((selectedId) => selectedId !== id)
    )
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? contentItems.map((item) => item.id) : [])
  }

  return (
    <div className="space-y-3">
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <div className="text-sm text-muted-foreground">
            {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updatePublicationState(selectedIds, false)}
              disabled={isSaving}
            >
              Mark not published
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              disabled={isSaving}
            >
              Clear selection
            </Button>
          </div>
        </div>
      )}

      {contentItems.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              {!readOnly && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allSelected
                        ? true
                        : someSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                    aria-label="Select all content items"
                  />
                </TableHead>
              )}
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              {!readOnly && (
                <TableHead className="text-right">Publish</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contentItems.map((item) => {
              const meta = kindMeta[item.kind]
              const Icon = meta.icon
              const isSelected = selectedIds.includes(item.id)

              return (
                <TableRow
                  key={item.id}
                  data-state={isSelected ? "selected" : undefined}
                >
                  {!readOnly && (
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleSelection(item.id, checked === true)
                        }
                        aria-label={`Select ${item.title}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.title}</div>
                        {item.detail && (
                          <div className="truncate text-xs text-muted-foreground">
                            {item.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{meta.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <div className="flex justify-end">
                        {item.kind === "material" && item.actionHref ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={item.actionHref}>View material</Link>
                          </Button>
                        ) : item.kind === "quiz" && item.actionHref ? (
                          <Button asChild size="sm" className="rounded-full">
                            <Link href={item.actionHref}>Take quiz</Link>
                          </Button>
                        ) : item.kind === "flashcardSet" && item.actionHref ? (
                          <Button asChild size="sm" className="rounded-full">
                            <Link href={item.actionHref}>Open flashcards</Link>
                          </Button>
                        ) : (
                          <Badge
                            variant={item.isPublished ? "default" : "secondary"}
                          >
                            {item.isPublished ? "Published" : "Not published"}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Badge
                        variant={item.isPublished ? "default" : "secondary"}
                      >
                        {item.isPublished ? "Published" : "Not published"}
                      </Badge>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground">
                          {item.isPublished ? "On" : "Off"}
                        </span>
                        <Switch
                          checked={item.isPublished}
                          onCheckedChange={(checked) =>
                            updatePublicationState([item.id], checked === true)
                          }
                          disabled={isSaving}
                          aria-label={`Toggle publish state for ${item.title}`}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <div
          className={cn(
            "rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
          )}
        >
          No items added yet.
        </div>
      )}
    </div>
  )
}
