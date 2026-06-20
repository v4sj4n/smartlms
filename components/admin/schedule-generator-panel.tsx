"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Clock,
  Play,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Shuffle,
  RefreshCw,
} from "lucide-react"
import type {
  GenerationMode,
  ScheduleConflict,
  GenerationStats,
  ScheduleEntry,
} from "@/lib/scheduling/types"
import type { DayOfWeek } from "@/lib/actions/schedules"

// ============================================================================
// TYPES
// ============================================================================

interface ScheduleGeneratorPanelProps {
  academicYearId: string
  onScheduleGenerated?: () => void
}

type GenerationStatus = "idle" | "generating" | "success" | "error"

// ============================================================================
// COMPONENT
// ============================================================================

export function ScheduleGeneratorPanel({
  academicYearId,
  onScheduleGenerated,
}: ScheduleGeneratorPanelProps) {
  const [mode, setMode] = React.useState<GenerationMode>("balanced")
  const [status, setStatus] = React.useState<GenerationStatus>("idle")
  const [progress, setProgress] = React.useState(0)
  const [conflicts, setConflicts] = React.useState<ScheduleConflict[]>([])
  const [stats, setStats] = React.useState<GenerationStats | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showApplyDialog, setShowApplyDialog] = React.useState(false)
  const [generatedSchedule, setGeneratedSchedule] = React.useState<
    ScheduleEntry[]
  >([])

  const handleGenerate = async () => {
    setStatus("generating")
    setProgress(10)
    setError(null)
    setConflicts([])

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 500)

      const response = await fetch("/api/schedules/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId,
          mode,
        }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate schedule")
      }

      const result = await response.json()

      setProgress(100)
      setGeneratedSchedule(result.schedule || [])
      setConflicts(result.conflicts || [])
      setStats(result.stats || null)

      if (result.success && result.schedule?.length > 0) {
        setStatus("success")
        setShowApplyDialog(true)
      } else if (result.conflicts?.length > 0) {
        setStatus("error")
        setError(`Generated schedule has ${result.conflicts.length} conflicts`)
      } else {
        setStatus("error")
        setError(result.error || "Failed to generate valid schedule")
      }
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Unknown error")
      setProgress(0)
    }
  }

  const handleApplySchedule = async () => {
    try {
      // Apply the generated schedule
      const response = await fetch("/api/schedules/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule: generatedSchedule,
          academicYearId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to apply schedule")
      }

      setShowApplyDialog(false)
      onScheduleGenerated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply schedule")
    }
  }

  const handleValidate = async () => {
    setStatus("generating")
    setProgress(50)

    try {
      const response = await fetch(
        `/api/schedules/validate?academicYearId=${academicYearId}`
      )

      if (!response.ok) {
        throw new Error("Failed to validate schedule")
      }

      const result = await response.json()
      setConflicts(result.conflicts || [])
      setStatus(result.valid ? "success" : "error")
      setError(
        result.valid ? null : `Found ${result.conflicts.length} conflicts`
      )
      setProgress(100)
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Validation failed")
      setProgress(0)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Schedule Generator
          </CardTitle>
          <CardDescription>
            Automatically generate conflict-free timetables using constraint
            satisfaction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Selection */}
          <div className="space-y-2">
            <Label>Generation Mode</Label>
            <Select
              value={mode}
              onValueChange={(value) => setMode(value as GenerationMode)}
              disabled={status === "generating"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">
                  <div className="flex items-center gap-2">
                    <Shuffle className="h-4 w-4" />
                    <span>Random (Fast)</span>
                  </div>
                </SelectItem>
                <SelectItem value="optimized">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Optimized (Better distribution)</span>
                  </div>
                </SelectItem>
                <SelectItem value="balanced">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Balanced (Group equilibrium)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {mode === "random"
                ? "Generates a valid schedule quickly without optimization"
                : mode === "balanced"
                  ? "Spreads each group's 2h blocks evenly across the week using professor availability"
                  : "Optimizes for even distribution and preferred time slots"}
            </p>
          </div>

          {/* Progress */}
          {status === "generating" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating schedule...
                </span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Status Alert */}
          {status === "success" && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                {stats && (
                  <span>
                    Generated schedule with {stats.scheduledAssignments}{" "}
                    assignments
                    {conflicts.length > 0 &&
                      ` and ${conflicts.length} warnings`}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Conflicts List */}
          {conflicts.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                Conflicts Detected ({conflicts.length})
              </h4>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border bg-muted/50 p-2">
                {conflicts.map((conflict, index) => (
                  <div key={index} className="text-xs text-muted-foreground">
                    <Badge variant="outline" className="mr-2 text-[10px]">
                      {conflict.type}
                    </Badge>
                    {conflict.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border bg-muted/50 p-2">
                <div className="text-lg font-bold">
                  {stats.scheduledAssignments}
                </div>
                <div className="text-xs text-muted-foreground">Assignments</div>
              </div>
              <div className="rounded-md border bg-muted/50 p-2">
                <div className="text-lg font-bold">{stats.iterations}</div>
                <div className="text-xs text-muted-foreground">Iterations</div>
              </div>
              <div className="rounded-md border bg-muted/50 p-2">
                <div className="text-lg font-bold">{stats.durationMs}ms</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={status === "generating"}
              className="flex-1"
            >
              {status === "generating" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Generate Schedule
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={status === "generating"}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Validate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Apply Schedule Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Generated Schedule?</DialogTitle>
            <DialogDescription>
              This will replace any existing schedule entries for this academic
              year.
              {conflicts.length > 0 && (
                <span className="mt-2 block text-yellow-600">
                  Warning: {conflicts.length} conflicts detected.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {generatedSchedule.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              <div className="mb-2 text-sm font-medium">
                Generated {generatedSchedule.length} schedule entries:
              </div>
              {generatedSchedule.slice(0, 5).map((entry, index) => (
                <div key={index} className="text-xs text-muted-foreground">
                  <Badge variant="outline" className="mr-2">
                    {entry.dayOfWeek}
                  </Badge>
                  {entry.startTime} - {entry.endTime}
                  {entry.room && ` • ${entry.room}`}
                </div>
              ))}
              {generatedSchedule.length > 5 && (
                <div className="text-xs text-muted-foreground italic">
                  ... and {generatedSchedule.length - 5} more
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApplySchedule}
              disabled={conflicts.length > 0}
            >
              {conflicts.length > 0 ? "Fix Conflicts First" : "Apply Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
