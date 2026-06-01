"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Sparkles,
  FileText,
  Loader2,
  Check,
  BookOpen,
  Calendar,
  Clock,
  Save,
} from "lucide-react"

import { createAssignment } from "@/lib/actions/assignments"
import { getWeekFiles } from "@/lib/actions/week-files"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

type FileItem = {
  id: string
  name: string
  mimeType: string
  size: number
  status: string
  createdAt: Date
}

type GeneratedAssignment = {
  title: string
  description: string
  type: "essay" | "project" | "homework" | "lab_report" | "presentation"
  maxScore: number
  timeLimitMinutes: number | null
  rubric: {
    criteria: { name: string; description: string; points: number }[]
  }
}

type Props = {
  weekId: string
  weekTitle: string
  trigger?: React.ReactNode
}

export function AIAssignmentGeneratorDialog({
  weekId,
  weekTitle,
  trigger,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"setup" | "edit">("setup")
  const [assignmentType, setAssignmentType] = useState<
    "essay" | "project" | "homework" | "lab_report" | "presentation"
  >("essay")
  const [focusPrompt, setFocusPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamedText, setStreamedText] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingFiles, setIsFetchingFiles] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [hasFetchedFiles, setHasFetchedFiles] = useState(false)
  const [assignmentDraft, setAssignmentDraft] =
    useState<GeneratedAssignment | null>(null)

  // Draft editing state
  const [draftTitle, setDraftTitle] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftType, setDraftType] =
    useState<GeneratedAssignment["type"]>("essay")
  const [draftSubmissionType, setDraftSubmissionType] = useState<
    "text" | "file" | "both"
  >("both")
  const [draftMaxScore, setDraftMaxScore] = useState(100)
  const [draftTimeLimit, setDraftTimeLimit] = useState<number | "">("")
  const [draftDueDate, setDraftDueDate] = useState("")
  const [draftRubric, setDraftRubric] = useState<GeneratedAssignment["rubric"]>(
    { criteria: [] }
  )
  const [draftAllowLate, setDraftAllowLate] = useState(true)

  const fetchFiles = useCallback(async () => {
    if (hasFetchedFiles) return
    setIsFetchingFiles(true)
    try {
      const result = await getWeekFiles(weekId)
      if (result.success && result.data) {
        setFiles(result.data)
        setSelectedFileIds(new Set(result.data.map((file) => file.id)))
        setHasFetchedFiles(true)
      } else {
        toast.error(result.error || "Failed to load files")
      }
    } catch {
      toast.error("Failed to load files")
    } finally {
      setIsFetchingFiles(false)
    }
  }, [weekId, hasFetchedFiles])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (nextOpen && !hasFetchedFiles) {
        void fetchFiles()
      }
      if (!nextOpen) {
        setStep("setup")
        setAssignmentDraft(null)
        setIsGenerating(false)
        setStreamedText("")
        setIsSaving(false)
      }
    },
    [fetchFiles, hasFetchedFiles]
  )

  const toggleFile = (fileId: string) => {
    setSelectedFileIds((previous) => {
      const next = new Set(previous)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }

  const handleGenerate = async () => {
    if (selectedFileIds.size === 0) {
      toast.error("Please select at least one source file")
      return
    }

    setIsGenerating(true)
    setStreamedText("")
    try {
      const response = await fetch("/api/ai/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekId,
          contentType: "assignment",
          assignmentType,
          focusPrompt: focusPrompt.trim() || undefined,
          fileIds: Array.from(selectedFileIds),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        toast.error(errorText || "Failed to generate assignment")
        return
      }

      if (!response.body) {
        toast.error("No response stream received")
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamedText(accumulated)
      }

      const rawText = accumulated.trim()
      if (!rawText) {
        toast.error("AI returned an empty response")
        return
      }

      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim()

      const objectStart = cleaned.indexOf("{")
      const objectEnd = cleaned.lastIndexOf("}")
      const jsonCandidate =
        objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart
          ? cleaned.slice(objectStart, objectEnd + 1)
          : cleaned

      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(jsonCandidate)
      } catch {
        toast.error("AI returned malformed JSON")
        return
      }

      const payload =
        parsedJson &&
        typeof parsedJson === "object" &&
        "assignment" in parsedJson
          ? parsedJson
          : parsedJson

      const assignment = (payload as { assignment?: GeneratedAssignment })
        .assignment
      if (!assignment || !assignment.title) {
        toast.error("AI did not return a valid assignment")
        return
      }

      setAssignmentDraft(assignment)
      setDraftTitle(assignment.title)
      setDraftDescription(assignment.description)
      setDraftType(assignment.type)
      setDraftMaxScore(assignment.maxScore)
      setDraftTimeLimit(assignment.timeLimitMinutes ?? "")
      setDraftRubric(assignment.rubric || { criteria: [] })
      setStep("edit")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!draftTitle.trim()) {
      toast.error("Assignment title is required")
      return
    }

    if (!draftDescription.trim()) {
      toast.error("Assignment description is required")
      return
    }

    setIsSaving(true)
    try {
      const result = await createAssignment({
        weekId,
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        type: draftType,
        origin: "ai_generated",
        submissionType: draftSubmissionType,
        maxScore: draftMaxScore,
        timeLimitMinutes:
          draftTimeLimit === "" ? undefined : Number(draftTimeLimit),
        dueDate: draftDueDate ? new Date(draftDueDate) : undefined,
        allowLateSubmissions: draftAllowLate,
        rubric: draftRubric.criteria.length > 0 ? draftRubric : undefined,
      })

      if (!result.success) {
        toast.error(result.error || "Failed to create assignment")
        return
      }

      toast.success("Assignment created successfully")
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create assignment"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const selectedCount = selectedFileIds.size
  const totalFiles = files.length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate with AI
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[98vw] sm:max-w-[50vw]">
        <div className="max-h-[85vh] overflow-y-auto pr-1">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {step === "setup"
                ? "Generate assignment with AI"
                : "Review AI Assignment Draft"}
            </DialogTitle>
            <DialogDescription>
              {step === "setup"
                ? `${weekTitle} — AI will generate an assignment draft from your materials.`
                : "Review and edit the generated assignment before saving."}
            </DialogDescription>
          </DialogHeader>

          {step === "setup" ? (
            <div
              className="space-y-5 pt-4"
              onKeyDown={(event) => {
                if (event.key === " ") {
                  event.stopPropagation()
                }
              }}
            >
              <div className="space-y-2">
                <Label>Assignment type</Label>
                <Select
                  value={assignmentType}
                  onValueChange={(value) =>
                    setAssignmentType(value as typeof assignmentType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essay">Essay</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="homework">Homework</SelectItem>
                    <SelectItem value="lab_report">Lab Report</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-focus">
                  Focus area / special instructions
                  <span className="ml-1 text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="ai-focus"
                  value={focusPrompt}
                  onChange={(e) => setFocusPrompt(e.target.value)}
                  placeholder="E.g. Focus on critical analysis, include specific formatting requirements..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Source materials</Label>
                  {totalFiles > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedCount} of {totalFiles} selected
                    </Badge>
                  )}
                </div>

                {isFetchingFiles ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading materials...
                  </div>
                ) : files.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    No materials found in this folder.
                    <br />
                    Upload files first before generating content.
                  </div>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {files.map((file) => (
                      <label
                        key={file.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
                      >
                        <Checkbox
                          checked={selectedFileIds.has(file.id)}
                          onCheckedChange={() => toggleFile(file.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {file.status === "READY"
                              ? "Ready for AI"
                              : file.status === "PROCESSING"
                                ? "Processing..."
                                : file.status}
                          </p>
                        </div>
                        {file.status === "READY" && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="gap-1.5"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate draft
                    </>
                  )}
                </Button>
              </div>

              {isGenerating && streamedText && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Generating assignment...</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <pre className="whitespace-pre-wrap">{streamedText}</pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="space-y-5 pt-4"
              onKeyDown={(event) => {
                if (event.key === " ") {
                  event.stopPropagation()
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="draft-title">Title</Label>
                <Input
                  id="draft-title"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Assignment title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="draft-type">Type</Label>
                <Select
                  value={draftType}
                  onValueChange={(value) =>
                    setDraftType(value as GeneratedAssignment["type"])
                  }
                >
                  <SelectTrigger id="draft-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essay">Essay</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="homework">Homework</SelectItem>
                    <SelectItem value="lab_report">Lab Report</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="draft-submission-type">Submission Type</Label>
                <Select
                  value={draftSubmissionType}
                  onValueChange={(value) =>
                    setDraftSubmissionType(value as "text" | "file" | "both")
                  }
                >
                  <SelectTrigger id="draft-submission-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">
                      Text only (paste/write)
                    </SelectItem>
                    <SelectItem value="file">File upload only</SelectItem>
                    <SelectItem value="both">Both text and file</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How students can submit their work
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="draft-description">
                  Description / Instructions
                </Label>
                <Textarea
                  id="draft-description"
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder="Assignment description and instructions"
                  rows={6}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="draft-score">
                    <BookOpen className="mr-1 inline h-4 w-4" />
                    Max Score
                  </Label>
                  <Input
                    id="draft-score"
                    type="number"
                    min={1}
                    max={1000}
                    value={draftMaxScore}
                    onChange={(e) =>
                      setDraftMaxScore(Math.max(1, Number(e.target.value) || 0))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="draft-time">
                    <Clock className="mr-1 inline h-4 w-4" />
                    Time Limit (minutes)
                  </Label>
                  <Input
                    id="draft-time"
                    type="number"
                    min={1}
                    placeholder="Optional"
                    value={draftTimeLimit}
                    onChange={(e) =>
                      setDraftTimeLimit(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="draft-due">
                  <Calendar className="mr-1 inline h-4 w-4" />
                  Due Date
                </Label>
                <Input
                  id="draft-due"
                  type="datetime-local"
                  value={draftDueDate}
                  onChange={(e) => setDraftDueDate(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="draft-late">Allow Late Submissions</Label>
                  <p className="text-xs text-muted-foreground">
                    Students can submit after the due date
                  </p>
                </div>
                <Switch
                  id="draft-late"
                  checked={draftAllowLate}
                  onCheckedChange={setDraftAllowLate}
                />
              </div>

              {draftRubric.criteria.length > 0 && (
                <div className="space-y-2">
                  <Label>Rubric Criteria</Label>
                  <div className="space-y-2">
                    {draftRubric.criteria.map((criterion, index) => (
                      <div
                        key={index}
                        className="space-y-2 rounded-lg border p-3"
                      >
                        <div className="flex items-center justify-between">
                          <Input
                            value={criterion.name}
                            onChange={(e) => {
                              const newCriteria = [...draftRubric.criteria]
                              newCriteria[index].name = e.target.value
                              setDraftRubric({ criteria: newCriteria })
                            }}
                            placeholder="Criterion name"
                            className="font-medium"
                          />
                          <Input
                            type="number"
                            min={0}
                            value={criterion.points}
                            onChange={(e) => {
                              const newCriteria = [...draftRubric.criteria]
                              newCriteria[index].points =
                                Number(e.target.value) || 0
                              setDraftRubric({ criteria: newCriteria })
                            }}
                            className="ml-2 w-20 text-right"
                            placeholder="Pts"
                          />
                        </div>
                        <Textarea
                          value={criterion.description}
                          onChange={(e) => {
                            const newCriteria = [...draftRubric.criteria]
                            newCriteria[index].description = e.target.value
                            setDraftRubric({ criteria: newCriteria })
                          }}
                          placeholder="Description of this criterion"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep("setup")}
                  disabled={isSaving}
                >
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Assignment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
