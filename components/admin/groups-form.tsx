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
import { createStudentGroup } from "@/lib/actions/academic-structure"

type Program = {
  id: string
  name: string
}

export function AdminGroupsForm({ programs }: { programs: Program[] }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [programId, setProgramId] = useState("")
  const [yearLevel, setYearLevel] = useState("1")
  const [capacity, setCapacity] = useState("30")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!programId) {
      toast.error("Select a study program")
      return
    }

    setIsSubmitting(true)
    const result = await createStudentGroup({
      name,
      studyProgramId: programId,
      yearLevel: Number(yearLevel),
      capacity: Number(capacity),
    })
    setIsSubmitting(false)

    if (!result.success) {
      toast.error(result.error ?? "Failed to create group")
      return
    }

    toast.success("Group created")
    setName("")
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create group</CardTitle>
        <CardDescription>Add a new student cohort</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group A"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Study program</Label>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger>
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="year-level">Year level</Label>
            <Input
              id="year-level"
              type="number"
              min={1}
              max={6}
              value={yearLevel}
              onChange={(e) => setYearLevel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create group"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
