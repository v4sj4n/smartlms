"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createSubjectAssignment } from "@/lib/actions/academic-structure"

type Professor = {
  id: string
  name: string | null
  fullName: string | null
  email: string
}
type Course = { id: string; title: string }
type Group = { id: string; name: string }

export function AdminSubjectAssignmentsForm({
  professors,
  courses,
  groups,
}: {
  professors: Professor[]
  courses: Course[]
  groups: Group[]
}) {
  const router = useRouter()
  const [professorId, setProfessorId] = useState("")
  const [courseId, setCourseId] = useState("")
  const [groupId, setGroupId] = useState("")
  const [requiredHours, setRequiredHours] = useState("2")
  const [sessionType, setSessionType] = useState<"lecture" | "seminar">(
    "lecture"
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!professorId || !courseId || !groupId) {
      toast.error("Fill all required fields")
      return
    }

    setIsSubmitting(true)
    const result = await createSubjectAssignment({
      professorId,
      courseId,
      groupId,
      requiredHours: Number(requiredHours),
      sessionType,
    })
    setIsSubmitting(false)

    if (!result.success) {
      toast.error(result.error ?? "Failed to create assignment")
      return
    }

    toast.success("Subject assignment created")
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New assignment</CardTitle>
        <CardDescription>
          Lectures and seminars use 2-hour blocks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Professor</Label>
            <Select value={professorId} onValueChange={setProfessorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select professor" />
              </SelectTrigger>
              <SelectContent>
                {professors.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName || p.name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Student group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Session type</Label>
            <Select
              value={sessionType}
              onValueChange={(v) => setSessionType(v as "lecture" | "seminar")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lecture">Lecture (2h)</SelectItem>
                <SelectItem value="seminar">Seminar (2h)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hours">Weekly hours</Label>
            <Input
              id="hours"
              type="number"
              min={2}
              step={2}
              value={requiredHours}
              onChange={(e) => setRequiredHours(e.target.value)}
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create assignment"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
