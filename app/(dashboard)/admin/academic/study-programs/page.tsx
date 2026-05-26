"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  FolderOpen,
  Plus,
  BookOpen,
  Users,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react"

type Program = {
  id: number
  name: string
  code: string
  description: string
  students: number
  courses: number
  color: string
  bgColor: string
}

const colorOptions = [
  {
    color:
      "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    bg: "bg-blue-500/10",
  },
  {
    color:
      "text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800",
    bg: "bg-violet-500/10",
  },
  {
    color:
      "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    bg: "bg-amber-500/10",
  },
  {
    color:
      "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    bg: "bg-emerald-500/10",
  },
  {
    color:
      "text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    bg: "bg-rose-500/10",
  },
  {
    color:
      "text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
    bg: "bg-cyan-500/10",
  },
]

const initialPrograms: Program[] = [
  {
    id: 1,
    name: "Informatics",
    code: "INFO",
    description: "Computer science, software engineering, and data systems.",
    students: 142,
    courses: 18,
    color: colorOptions[0].color,
    bgColor: colorOptions[0].bg,
  },
  {
    id: 2,
    name: "Business Administration",
    code: "BUS",
    description: "Management, finance, marketing, and entrepreneurship.",
    students: 98,
    courses: 14,
    color: colorOptions[2].color,
    bgColor: colorOptions[2].bg,
  },
  {
    id: 3,
    name: "Architecture",
    code: "ARCH",
    description:
      "Architectural design, urban planning, and structural systems.",
    students: 67,
    courses: 11,
    color: colorOptions[1].color,
    bgColor: colorOptions[1].bg,
  },
  {
    id: 4,
    name: "Civil Engineering",
    code: "CE",
    description:
      "Infrastructure, structural mechanics, and environmental systems.",
    students: 54,
    courses: 9,
    color: colorOptions[3].color,
    bgColor: colorOptions[3].bg,
  },
]

function ProgramCard({
  program,
  onDelete,
}: {
  program: Program
  onDelete: (id: number) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState(program.name)
  const [code, setCode] = React.useState(program.code)
  const [desc, setDesc] = React.useState(program.description)

  return (
    <Card className="overflow-hidden rounded-2xl border border-border/40 shadow-sm transition-[border-color] duration-150 hover:border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase ${program.color} ${program.bgColor} shrink-0`}
            >
              {code}
            </div>
            <div className="flex flex-col gap-0.5">
              <CardTitle className="font-heading text-base leading-snug font-bold">
                {editing ? (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-7 rounded-lg px-2 text-sm font-bold"
                  />
                ) : (
                  name
                )}
              </CardTitle>
              {!editing && (
                <CardDescription
                  className="text-xs leading-relaxed"
                  style={{ textWrap: "pretty" } as React.CSSProperties}
                >
                  {desc}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-lg text-muted-foreground transition-transform hover:text-foreground active:scale-[0.96]"
              onClick={() => setEditing((p) => !p)}
              aria-label={editing ? "Cancel edit" : "Edit program"}
            >
              {editing ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </Button>
            {editing ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-primary transition-transform hover:text-primary active:scale-[0.96]"
                onClick={() => setEditing(false)}
                aria-label="Save changes"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-muted-foreground transition-transform hover:text-destructive active:scale-[0.96]"
                onClick={() => onDelete(program.id)}
                aria-label="Delete program"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {editing ? (
        <CardContent className="flex flex-col gap-3 border-t border-border/30 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Program Code
            </Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-8 w-24 rounded-xl text-xs"
              maxLength={8}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="resize-none rounded-xl text-xs"
              rows={2}
            />
          </div>
        </CardContent>
      ) : (
        <CardContent className="px-5 pt-0 pb-4">
          <div className="mt-1 flex items-center gap-4 border-t border-border/20 pt-3 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 tabular-nums">
              <Users className="h-3.5 w-3.5" />
              {program.students} students
            </span>
            <span className="flex items-center gap-1.5 tabular-nums">
              <BookOpen className="h-3.5 w-3.5" />
              {program.courses} courses
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function StudyProgramsPage() {
  const [programs, setPrograms] = React.useState<Program[]>(initialPrograms)
  const [creating, setCreating] = React.useState(false)
  const [colorIdx, setColorIdx] = React.useState(0)
  const [newName, setNewName] = React.useState("")
  const [newCode, setNewCode] = React.useState("")
  const [newDesc, setNewDesc] = React.useState("")

  const handleCreate = () => {
    if (!newName || !newCode) return
    const c = colorOptions[colorIdx % colorOptions.length]
    setPrograms((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newName,
        code: newCode.toUpperCase(),
        description: newDesc,
        students: 0,
        courses: 0,
        color: c.color,
        bgColor: c.bg,
      },
    ])
    setNewName("")
    setNewCode("")
    setNewDesc("")
    setColorIdx((i) => i + 1)
    setCreating(false)
  }

  const handleDelete = (id: number) => {
    setPrograms((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1
            className="font-heading text-3xl font-extrabold tracking-tight text-foreground"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Study Programs
          </h1>
          <p
            className="text-sm text-muted-foreground"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            Create and manage academic programs students belong to each school
            year.
          </p>
        </div>
        <Button
          className="shrink-0 rounded-xl transition-transform active:scale-[0.96]"
          onClick={() => setCreating((p) => !p)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Program
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Programs", value: programs.length, icon: FolderOpen },
          {
            label: "Total Students",
            value: programs.reduce((s, p) => s + p.students, 0),
            icon: Users,
          },
          {
            label: "Total Courses",
            value: programs.reduce((s, p) => s + p.courses, 0),
            icon: BookOpen,
          },
          { label: "Active Year", value: "2025–2026", icon: null },
        ].map(({ label, value }) => (
          <Card
            key={label}
            className="rounded-2xl border border-border/40 shadow-sm"
          >
            <CardContent className="flex flex-col gap-1 p-4">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {label}
              </p>
              <p className="text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create form */}
      {creating && (
        <Card className="rounded-2xl border border-primary/20 bg-primary/3 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-base font-bold">
              <Plus className="h-4 w-4 text-primary" />
              New Study Program
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label
                  htmlFor="prog-name"
                  className="text-xs text-muted-foreground"
                >
                  Program Name
                </Label>
                <Input
                  id="prog-name"
                  placeholder="e.g. Informatics"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9 rounded-xl"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="prog-code"
                  className="text-xs text-muted-foreground"
                >
                  Code (short)
                </Label>
                <Input
                  id="prog-code"
                  placeholder="e.g. INFO"
                  value={newCode}
                  maxLength={8}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  className="h-9 rounded-xl uppercase"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="prog-desc"
                className="text-xs text-muted-foreground"
              >
                Description (optional)
              </Label>
              <Textarea
                id="prog-desc"
                placeholder="Brief description of this program..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="resize-none rounded-xl"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl transition-transform active:scale-[0.96]"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-xl transition-transform active:scale-[0.96]"
                onClick={handleCreate}
                disabled={!newName || !newCode}
              >
                Create Program
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Program grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {programs.map((prog) => (
          <ProgramCard key={prog.id} program={prog} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  )
}
