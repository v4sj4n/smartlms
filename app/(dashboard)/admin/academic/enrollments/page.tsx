"use client"

import * as React from "react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, GraduationCap, X, CheckCircle2 } from "lucide-react"

type Student = {
  id: number
  name: string
  email: string
  programCode: string | null
}

type Program = {
  id: number
  name: string
  code: string
  color: string
  bg: string
}

const programs: Program[] = [
  {
    id: 1,
    name: "Informatics",
    code: "INFO",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-200 dark:border-blue-800",
  },
  {
    id: 2,
    name: "Business Administration",
    code: "BUS",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-200 dark:border-amber-800",
  },
  {
    id: 3,
    name: "Architecture",
    code: "ARCH",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10 border-violet-200 dark:border-violet-800",
  },
  {
    id: 4,
    name: "Civil Engineering",
    code: "CE",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-800",
  },
]

const initialStudents: Student[] = [
  {
    id: 1,
    name: "Alex Moreau",
    email: "a.moreau@school.edu",
    programCode: "INFO",
  },
  {
    id: 2,
    name: "Sophia Ruiz",
    email: "s.ruiz@school.edu",
    programCode: "INFO",
  },
  {
    id: 3,
    name: "Tom Fischer",
    email: "t.fischer@school.edu",
    programCode: "ARCH",
  },
  { id: 4, name: "Maria Chen", email: "m.chen@school.edu", programCode: "BUS" },
  {
    id: 5,
    name: "James Okafor",
    email: "j.okafor@school.edu",
    programCode: null,
  },
  {
    id: 6,
    name: "Lena Kovacs",
    email: "l.kovacs@school.edu",
    programCode: null,
  },
  {
    id: 7,
    name: "Nadia Serrano",
    email: "n.serrano@school.edu",
    programCode: "CE",
  },
  {
    id: 8,
    name: "Omar Al-Rashid",
    email: "o.alrashid@school.edu",
    programCode: null,
  },
]

const FILTER_OPTIONS = [
  { value: "all", label: "All students" },
  { value: "unassigned", label: "Unassigned" },
  ...programs.map((p) => ({ value: p.code, label: p.name })),
]

export default function EnrollmentsPage() {
  const [students, setStudents] = React.useState<Student[]>(initialStudents)
  const [query, setQuery] = React.useState("")
  const [filterProgram, setFilter] = React.useState("all")

  const handleAssign = (studentId: number, code: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, programCode: code === "__none__" ? null : code }
          : s
      )
    )
  }

  const filtered = students.filter((s) => {
    const q = query.toLowerCase()
    const matchQuery =
      s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    const matchFilter =
      filterProgram === "all" ||
      (filterProgram === "unassigned" && !s.programCode) ||
      s.programCode === filterProgram
    return matchQuery && matchFilter
  })

  const enrolled = students.filter((s) => !!s.programCode).length
  const unassigned = students.length - enrolled

  const getProg = (code: string | null) =>
    programs.find((p) => p.code === code) ?? null

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h1
          className="font-heading text-3xl font-extrabold tracking-tight text-foreground"
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          Student Enrollment
        </h1>
        <p
          className="text-sm text-muted-foreground"
          style={{ textWrap: "pretty" } as React.CSSProperties}
        >
          Assign students to study programs for the active school year
          (2025–2026).
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Students", value: students.length, highlight: false },
          { label: "Enrolled", value: enrolled, highlight: enrolled > 0 },
          { label: "Unassigned", value: unassigned, highlight: unassigned > 0 },
          { label: "Programs", value: programs.length, highlight: false },
        ].map(({ label, value, highlight }) => (
          <Card
            key={label}
            className="rounded-2xl border border-border/40 shadow-sm"
          >
            <CardContent className="flex flex-col gap-1 p-4">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {label}
              </p>
              <p
                className={`text-2xl font-extrabold tracking-tight tabular-nums ${
                  highlight
                    ? label === "Unassigned"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-primary"
                    : ""
                }`}
              >
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        {/* Search — shadcn Input */}
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            id="enrollment-search"
            placeholder="Search students…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 rounded-xl pl-8 text-sm"
          />
        </div>

        {/* Program filter — shadcn Select */}
        <Select value={filterProgram} onValueChange={setFilter}>
          <SelectTrigger id="enrollment-filter" className="h-9 w-48 rounded-xl">
            <SelectValue placeholder="Filter by program" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Student table — shadcn Table */}
      <Card className="overflow-hidden rounded-2xl border border-border/40 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/30 bg-muted/30 hover:bg-muted/30">
              <TableHead className="px-5 py-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Student
              </TableHead>
              <TableHead className="hidden px-5 py-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:table-cell">
                Email
              </TableHead>
              <TableHead className="px-5 py-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Program
              </TableHead>
              <TableHead className="px-5 py-3 text-right text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Assign
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="px-5 py-10 text-center text-sm text-muted-foreground"
                >
                  No students match this filter.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((student) => {
                const prog = getProg(student.programCode)
                return (
                  <TableRow key={student.id} className="hover:bg-muted/20">
                    {/* Name */}
                    <TableCell className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                          <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {student.name}
                        </span>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="hidden px-5 py-3 text-xs text-muted-foreground sm:table-cell">
                      {student.email}
                    </TableCell>

                    {/* Current program badge */}
                    <TableCell className="px-5 py-3">
                      {prog ? (
                        <Badge
                          variant="outline"
                          className={`border text-[10px] font-bold tracking-wide uppercase ${prog.bg} ${prog.color}`}
                        >
                          {prog.code}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">
                          Unassigned
                        </span>
                      )}
                    </TableCell>

                    {/* Assign — shadcn Select */}
                    <TableCell className="px-5 py-3 text-right">
                      <Select
                        value={student.programCode ?? "__none__"}
                        onValueChange={(v) => handleAssign(student.id, v)}
                      >
                        <SelectTrigger
                          id={`assign-${student.id}`}
                          size="sm"
                          className="ml-auto w-36 rounded-lg"
                        >
                          <SelectValue placeholder="Assign…" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl" align="end">
                          <SelectItem value="__none__">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <X className="h-3 w-3" />
                              None
                            </span>
                          </SelectItem>
                          {programs.map((p) => (
                            <SelectItem key={p.code} value={p.code}>
                              <span className="flex items-center gap-1.5">
                                {student.programCode === p.code && (
                                  <CheckCircle2 className="h-3 w-3 text-primary" />
                                )}
                                <span className={`font-semibold ${p.color}`}>
                                  {p.code}
                                </span>
                                <span className="text-foreground/80">
                                  {p.name}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
