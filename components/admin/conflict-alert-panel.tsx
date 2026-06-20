"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertTriangle,
  X,
  User,
  MapPin,
  Users,
  Clock,
  AlertCircle,
} from "lucide-react"
import type { ScheduleConflict } from "@/lib/scheduling/types"

// ============================================================================
// TYPES
// ============================================================================

interface ConflictAlertPanelProps {
  conflicts: ScheduleConflict[]
  onDismiss?: (index: number) => void
  onDismissAll?: () => void
  className?: string
}

// ============================================================================
// CONFLICT ICONS
// ============================================================================

const CONFLICT_ICONS = {
  PROFESSOR_OVERLAP: User,
  ROOM_OVERLAP: MapPin,
  GROUP_OVERLAP: Users,
  PROFESSOR_HOURS_EXCEEDED: Clock,
  HOUR_SHORTAGE: AlertCircle,
  HOUR_OVER_ALLOCATION: AlertCircle,
  INVALID_TIME_SLOT: AlertTriangle,
  GROUP_DAILY_OVERLOAD: AlertTriangle,
}

const CONFLICT_COLORS = {
  PROFESSOR_OVERLAP: "bg-red-100 text-red-700 border-red-200",
  ROOM_OVERLAP: "bg-orange-100 text-orange-700 border-orange-200",
  GROUP_OVERLAP: "bg-yellow-100 text-yellow-700 border-yellow-200",
  PROFESSOR_HOURS_EXCEEDED: "bg-blue-100 text-blue-700 border-blue-200",
  HOUR_SHORTAGE: "bg-purple-100 text-purple-700 border-purple-200",
  HOUR_OVER_ALLOCATION: "bg-pink-100 text-pink-700 border-pink-200",
  INVALID_TIME_SLOT: "bg-gray-100 text-gray-700 border-gray-200",
  GROUP_DAILY_OVERLOAD: "bg-amber-100 text-amber-700 border-amber-200",
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ConflictAlertPanel({
  conflicts,
  onDismiss,
  onDismissAll,
  className,
}: ConflictAlertPanelProps) {
  // Group conflicts by type - must be before any early returns (React hooks rule)
  const groupedConflicts = React.useMemo(() => {
    if (conflicts.length === 0) return null

    const groups = new Map<string, ScheduleConflict[]>()

    for (const conflict of conflicts) {
      const existing = groups.get(conflict.type) || []
      existing.push(conflict)
      groups.set(conflict.type, existing)
    }

    return groups
  }, [conflicts])

  if (conflicts.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </div>
            No Conflicts
          </CardTitle>
          <CardDescription>
            The current schedule is valid with no detected conflicts.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Schedule Conflicts
            <Badge variant="destructive" className="ml-2">
              {conflicts.length}
            </Badge>
          </CardTitle>
          {onDismissAll && (
            <Button variant="ghost" size="sm" onClick={onDismissAll}>
              <X className="mr-2 h-4 w-4" />
              Dismiss All
            </Button>
          )}
        </div>
        <CardDescription>
          {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}{" "}
          detected that need attention
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Summary by type */}
        <div className="mb-4 flex flex-wrap gap-2">
          {groupedConflicts &&
            Array.from(groupedConflicts.entries()).map(([type, items]) => {
              const Icon =
                CONFLICT_ICONS[type as keyof typeof CONFLICT_ICONS] ||
                AlertTriangle
              return (
                <Badge
                  key={type}
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  <Icon className="h-3 w-3" />
                  {type.replace(/_/g, " ").toLowerCase()}: {items.length}
                </Badge>
              )
            })}
        </div>

        {/* Conflict list */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {conflicts.map((conflict, index) => {
              const Icon = CONFLICT_ICONS[conflict.type] || AlertTriangle
              const colorClass =
                CONFLICT_COLORS[conflict.type] ||
                "bg-gray-100 text-gray-700 border-gray-200"

              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${colorClass}`}
                >
                  <div className="mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {conflict.type.replace(/_/g, " ")}
                      </Badge>
                      {onDismiss && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => onDismiss(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {conflict.description}
                    </p>
                    {conflict.type === "PROFESSOR_OVERLAP" && (
                      <p className="mt-1 text-xs opacity-80">
                        Professor ID:{" "}
                        {(conflict as { professorId: string }).professorId}
                      </p>
                    )}
                    {conflict.type === "ROOM_OVERLAP" && (
                      <p className="mt-1 text-xs opacity-80">
                        Room: {(conflict as { room: string }).room}
                      </p>
                    )}
                    {conflict.type === "GROUP_OVERLAP" && (
                      <p className="mt-1 text-xs opacity-80">
                        Group ID: {(conflict as { groupId: string }).groupId}
                      </p>
                    )}
                    {(conflict.type === "HOUR_SHORTAGE" ||
                      conflict.type === "HOUR_OVER_ALLOCATION") && (
                      <p className="mt-1 text-xs opacity-80">
                        Required: {(conflict as { required: number }).required}
                        h, Assigned:{" "}
                        {(conflict as { assigned: number }).assigned}h
                      </p>
                    )}
                    {conflict.type === "PROFESSOR_HOURS_EXCEEDED" && (
                      <p className="mt-1 text-xs opacity-80">
                        Max: {(conflict as { max: number }).max}h, Assigned:{" "}
                        {(conflict as { assigned: number }).assigned}h
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {/* Action hint */}
        <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
          <p className="font-medium">How to resolve:</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            <li>
              Use the Schedule Generator to create a new conflict-free schedule
            </li>
            <li>Manually adjust conflicting entries in the Timetable</li>
            <li>Check professor availability settings</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// COMPACT VERSION (for dashboard widgets)
// ============================================================================

interface CompactConflictAlertProps {
  conflictCount: number
  onClick?: () => void
  className?: string
}

export function CompactConflictAlert({
  conflictCount,
  onClick,
  className,
}: CompactConflictAlertProps) {
  if (conflictCount === 0) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm ${className}`}
      >
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-green-700">No conflicts</span>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm transition-colors hover:bg-red-100 ${className}`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="font-medium text-red-700">
          {conflictCount} schedule conflict{conflictCount !== 1 ? "s" : ""}
        </span>
      </div>
      <Badge variant="destructive" className="text-xs">
        Action Required
      </Badge>
    </button>
  )
}
