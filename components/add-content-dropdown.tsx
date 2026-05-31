"use client"

import {
  Plus,
  FileText,
  HelpCircle,
  Layers,
  Sparkles,
  ClipboardCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { AIContentGeneratorDialog } from "@/components/ai-content-generator-dialog"

interface AddContentDropdownProps {
  courseId: string
  weekId: string
  weekTitle: string
}

export function AddContentDropdown({
  courseId,
  weekId,
  weekTitle,
}: AddContentDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add Content
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild>
          <Link
            href={`/professor/courses/${courseId}/files/new?folderId=${weekId}`}
            className="flex cursor-pointer items-center px-4 py-2"
          >
            <FileText className="mr-2 h-4 w-4" />
            Materials
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`/professor/courses/${courseId}/quizzes/new?folderId=${weekId}`}
            className="flex cursor-pointer items-center px-4 py-2"
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Quizzes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`/professor/courses/${courseId}/assignments/new?folderId=${weekId}`}
            className="flex cursor-pointer items-center px-4 py-2"
          >
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Assignments
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`/professor/courses/${courseId}/flashcards/new?folderId=${weekId}`}
            className="flex cursor-pointer items-center px-4 py-2"
          >
            <Layers className="mr-2 h-4 w-4" />
            Flashcards
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0">
          <AIContentGeneratorDialog
            weekId={weekId}
            weekTitle={weekTitle}
            trigger={
              <div className="flex cursor-pointer items-center px-4 py-2">
                <Sparkles className="mr-2 h-4 w-4 text-amber-400" />
                <span className="">GenAI</span>
              </div>
            }
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
