"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PendingSubmission } from "@/lib/actions/dashboard-intelligence"
import { FileText, Clock, ArrowRight, CheckCircle2 } from "lucide-react"

interface RecentSubmissionsPanelProps {
  submissions: PendingSubmission[]
  maxItems?: number
}

export function RecentSubmissionsPanel({
  submissions,
  maxItems = 5,
}: RecentSubmissionsPanelProps) {
  const visibleSubmissions = submissions.slice(0, maxItems)
  const pendingCount = submissions.length

  return (
    <Card className="surface-elevated">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Pending Submissions
            </CardTitle>
            <CardDescription className="mt-1">
              {pendingCount === 0
                ? "No submissions to grade"
                : `${pendingCount} submission${pendingCount !== 1 ? "s" : ""} waiting`}
            </CardDescription>
          </div>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="h-5 px-2 text-xs">
              {pendingCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleSubmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              All caught up!
            </p>
            <p className="text-xs text-muted-foreground">
              No pending submissions to grade.
            </p>
          </div>
        ) : (
          <>
            {visibleSubmissions.map((submission) => (
              <Link
                key={submission.id}
                href={submission.href}
                className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3 transition-colors hover:bg-muted/50 hover:border-border"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {submission.studentName || submission.studentEmail}
                    </p>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] capitalize"
                    >
                      {submission.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="truncate">{submission.assignmentTitle}</span>
                    <span className="text-border">•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(submission.submittedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
