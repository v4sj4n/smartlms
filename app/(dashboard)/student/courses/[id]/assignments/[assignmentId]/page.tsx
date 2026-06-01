"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { useDropzone } from "react-dropzone"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  ClipboardCheck,
  Clock,
  FileText,
  Upload,
  X,
  File,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { submitAssignment } from "@/lib/actions/submissions"
import { getSignedUploadUrl } from "@/lib/actions/files"
import { AssignmentAiAssistant } from "@/components/assignment-ai-assistant"
import { BreadcrumbLabels } from "@/components/breadcrumb-labels"

type Assignment = {
  id: string
  title: string
  description: string | null
  type: "essay" | "project" | "homework" | "lab_report" | "presentation"
  maxScore: number
  dueDate: Date | null
  timeLimitMinutes: number | null
  allowLateSubmissions: boolean
  submissionType: "text" | "file" | "both"
  isPublished: boolean
  rubric: {
    criteria: { name: string; description: string; points: number }[]
  } | null
  sourceFile?: {
    id: string
    name: string
    contentUrl: string | null
    fileType: string | null
  } | null
}

type Chatbot = {
  id: string
  name: string
  model?: string
} | null

type Submission = {
  id: string
  content: string | null
  fileUrl: string | null
  fileName: string | null
  score: number | null
  feedback: string | null
  status: string
  submittedAt: Date
} | null

type Props = {
  params: Promise<{
    id: string
    assignmentId: string
  }>
  searchParams: Promise<{
    weekId?: string
  }>
}

export default function AssignmentDetailPage({ params, searchParams }: Props) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [submission, setSubmission] = useState<Submission>(null)
  const [textContent, setTextContent] = useState("")
  const [uploadedFile, setUploadedFile] = useState<{
    url: string
    name: string
  } | null>(null)
  const [courseId, setCourseId] = useState("")
  const [weekId, setWeekId] = useState("")
  const [courseTitle, setCourseTitle] = useState("")
  const [chatbot, setChatbot] = useState<Chatbot>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      const { id, assignmentId } = await params
      const { weekId: wId } = await searchParams
      setCourseId(id)
      setWeekId(wId || "")

      try {
        const response = await fetch(`/api/assignments/${assignmentId}`)
        if (!response.ok) throw new Error("Failed to load assignment")
        const data = await response.json()
        setAssignment(data.assignment)
        setSubmission(data.submission)
        setChatbot(data.chatbot)
        setConversationId(data.conversationId)
        setCourseTitle(data.courseTitle || "")
        if (data.submission?.content) {
          setTextContent(data.submission.content)
        }
        if (data.submission?.fileUrl) {
          setUploadedFile({
            url: data.submission.fileUrl,
            name: data.submission.fileName || "Submitted file",
          })
        }
      } catch {
        toast.error("Failed to load assignment")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (file.size > maxSize) {
      toast.error("File size must be less than 10MB")
      return
    }

    try {
      setIsSubmitting(true)
      const signedUrl = await getSignedUploadUrl(file.name, file.type)

      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      })

      if (!uploadResponse.ok) throw new Error("Upload failed")

      const fileUrl = signedUrl.split("?")[0]
      setUploadedFile({ url: fileUrl, name: file.name })
      toast.success("File uploaded successfully")
    } catch {
      toast.error("Failed to upload file")
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    disabled: isSubmitting,
  })

  const handleSubmit = async () => {
    if (!assignment || !weekId) return

    if (assignment.submissionType === "file" && !uploadedFile) {
      toast.error("Please upload a file")
      return
    }

    if (assignment.submissionType === "text" && !textContent.trim()) {
      toast.error("Please enter your submission text")
      return
    }

    if (
      assignment.submissionType === "both" &&
      !uploadedFile &&
      !textContent.trim()
    ) {
      toast.error("Please provide a text response or upload a file")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await submitAssignment({
        assignmentId: assignment.id,
        weekId,
        content: textContent.trim() || undefined,
        fileUrl: uploadedFile?.url,
        fileName: uploadedFile?.name,
      })

      if (!result.success) {
        toast.error(result.error || "Failed to submit")
        return
      }

      toast.success(
        result.isUpdate ? "Submission updated" : "Assignment submitted"
      )
      router.refresh()
    } catch {
      toast.error("Failed to submit assignment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
  }

  const isLate = assignment?.dueDate
    ? new Date() > new Date(assignment.dueDate)
    : false

  const canSubmit =
    assignment &&
    (!isLate || assignment.allowLateSubmissions) &&
    !submission?.score

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <p>Assignment not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <BreadcrumbLabels
        labels={{
          [`/student/courses/${courseId}`]: courseTitle,
          [`/student/courses/${courseId}/assignments/${assignment?.id}`]:
            assignment?.title || "Assignment Details",
        }}
      />
      <div className="flex items-center gap-3">
        <Link href={`/student/courses/${courseId}/assignments`}>
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{assignment.title}</h1>
          <p className="text-muted-foreground">Assignment Details</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Assignment Info */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Instructions</CardTitle>
                <Badge variant="outline">{assignment.type}</Badge>
              </div>
              <CardDescription>
                Read the assignment carefully before submitting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignment.description ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">
                    {assignment.description}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No additional instructions provided.
                </p>
              )}

              <Separator />

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>Max Score: {assignment.maxScore}</span>
                </div>
                {assignment.dueDate && (
                  <div
                    className={`flex items-center gap-1.5 ${
                      isLate ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                    <span>
                      Due: {new Date(assignment.dueDate).toLocaleString()}
                      {isLate && " (Overdue)"}
                    </span>
                  </div>
                )}
                {assignment.timeLimitMinutes && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{assignment.timeLimitMinutes} minute limit</span>
                  </div>
                )}
              </div>

              {/* Open Assignment File Button */}
              {assignment.sourceFile?.contentUrl && (
                <div className="pt-2">
                  <Button variant="outline" className="gap-2" asChild>
                    <a
                      href={
                        assignment.sourceFile.contentUrl.startsWith("http")
                          ? assignment.sourceFile.contentUrl
                          : `/api/uploads/download?path=${encodeURIComponent(assignment.sourceFile.contentUrl)}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Assignment File
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submission Form */}
          {(!submission || submission.score === null) && (
            <Card>
              <CardHeader>
                <CardTitle>Your Submission</CardTitle>
                <CardDescription>
                  {assignment.submissionType === "text"
                    ? "Enter your response below"
                    : assignment.submissionType === "file"
                      ? "Upload your submission file"
                      : "Enter text or upload a file (or both)"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(assignment.submissionType === "text" ||
                  assignment.submissionType === "both") && (
                  <div className="space-y-2">
                    <Label htmlFor="submission-text">Text Response</Label>
                    <Textarea
                      id="submission-text"
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Enter your assignment response here..."
                      rows={8}
                      disabled={!canSubmit || isSubmitting}
                    />
                  </div>
                )}

                {(assignment.submissionType === "file" ||
                  assignment.submissionType === "both") && (
                  <div className="space-y-2">
                    <Label>File Upload</Label>
                    {!uploadedFile ? (
                      <div
                        {...getRootProps()}
                        className={`rounded-lg border-2 border-dashed p-6 transition-colors ${
                          isDragActive
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        } ${!canSubmit || isSubmitting ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                      >
                        <input
                          {...getInputProps()}
                          disabled={!canSubmit || isSubmitting}
                        />
                        <div className="flex flex-col items-center gap-2 text-center">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">
                            {isDragActive
                              ? "Drop the file here"
                              : "Drag & drop a file, or click to select"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Max file size: 10MB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 rounded-lg border p-3">
                        <File className="h-8 w-8 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {uploadedFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ready to submit
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={removeFile}
                          disabled={isSubmitting}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {isLate && !assignment.allowLateSubmissions && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      This assignment is past due and late submissions are not
                      allowed.
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      router.push(`/student/courses/${courseId}/assignments`)
                    }
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      !canSubmit ||
                      isSubmitting ||
                      (assignment.submissionType === "file" && !uploadedFile) ||
                      (assignment.submissionType === "text" &&
                        !textContent.trim()) ||
                      (assignment.submissionType === "both" &&
                        !uploadedFile &&
                        !textContent.trim())
                    }
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : submission ? (
                      "Update Submission"
                    ) : (
                      "Submit Assignment"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submitted View */}
          {submission && submission.score === null && (
            <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <CardTitle>Submitted</CardTitle>
                </div>
                <CardDescription>
                  Submitted on{" "}
                  {new Date(submission.submittedAt).toLocaleString()}
                  {submission.status === "late" && (
                    <span className="ml-2 text-amber-600">
                      (Late submission)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {submission.content && (
                  <div className="space-y-2">
                    <Label>Your Text Response</Label>
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="text-sm whitespace-pre-wrap">
                        {submission.content}
                      </p>
                    </div>
                  </div>
                )}
                {submission.fileUrl && (
                  <div className="space-y-2">
                    <Label>Your File</Label>
                    <a
                      href={submission.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
                    >
                      <File className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">Download submitted file</p>
                        <p className="text-xs text-muted-foreground">
                          Click to view
                        </p>
                      </div>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              {submission?.score !== null && submission?.score !== undefined ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Graded</span>
                  </div>
                  <div className="rounded-lg bg-green-100 p-4 text-center dark:bg-green-900">
                    <p className="text-3xl font-bold text-green-800 dark:text-green-100">
                      {submission.score}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-200">
                      / {assignment.maxScore} points
                    </p>
                  </div>
                  {submission.feedback && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Feedback:</p>
                      <p className="text-sm text-muted-foreground">
                        {submission.feedback}
                      </p>
                    </div>
                  )}
                </div>
              ) : submission ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Submitted</p>
                    <p className="text-xs text-muted-foreground">
                      Waiting for grading
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Not Submitted</p>
                    <p className="text-xs text-muted-foreground">
                      {canSubmit ? "Ready to submit" : "Submission closed"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rubric Card */}
          {assignment.rubric && assignment.rubric.criteria.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Grading Rubric</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {assignment.rubric.criteria.map((criterion, index) => (
                    <div key={index} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{criterion.name}</p>
                        <Badge variant="secondary">
                          {criterion.points} pts
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {criterion.description}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Floating Assignment AI Assistant */}
      {(!submission || submission.score === null) &&
        chatbot &&
        conversationId && (
          <AssignmentAiAssistant
            assignmentTitle={assignment.title}
            assignmentDescription={assignment.description}
            weekId={weekId}
            chatbotId={chatbot.id}
            conversationId={conversationId}
            model={chatbot.model || "gemini-2.0-flash-lite"}
          />
        )}
    </div>
  )
}
