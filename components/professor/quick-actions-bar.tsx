"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, FileText, HelpCircle, Megaphone, Upload } from "lucide-react"

interface QuickActionsBarProps {
  courseId: string
}

export function QuickActionsBar({ courseId }: QuickActionsBarProps) {
  const actions = [
    {
      label: "Assignment",
      href: `/professor/courses/${courseId}/assignments/new`,
      icon: FileText,
      variant: "default" as const,
    },
    {
      label: "Quiz",
      href: `/professor/courses/${courseId}/quizzes/new`,
      icon: HelpCircle,
      variant: "outline" as const,
    },
    {
      label: "Material",
      href: `/professor/courses/${courseId}/materials/new`,
      icon: Upload,
      variant: "outline" as const,
    },
    {
      label: "Announcement",
      href: `/professor/courses/${courseId}/announcements/new`,
      icon: Megaphone,
      variant: "outline" as const,
    },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Link key={action.label} href={action.href}>
          <Button
            variant={action.variant}
            size="sm"
            className="transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {action.label}
          </Button>
        </Link>
      ))}
    </div>
  )
}
