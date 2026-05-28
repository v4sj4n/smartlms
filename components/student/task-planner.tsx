"use client"

import { useState, useRef } from "react"
import { Plus } from "lucide-react"

interface Task {
  id: number
  text: string
  due: string
  done: boolean
}

const DEFAULT_TASKS: Task[] = [
  { id: 1, text: "Read Chapter 4", due: "26/05", done: false },
  { id: 2, text: "C# Lab report", due: "27/05", done: false },
  { id: 3, text: "OS assignment", due: "29/05", done: false },
]

export function TaskPlanner() {
  const [tasks, setTasks] = useState<Task[]>(DEFAULT_TASKS)
  const [nextId, setNextId] = useState(4)
  const newInputRef = useRef<HTMLInputElement>(null)

  function addTask() {
    const newTask: Task = { id: nextId, text: "", due: "", done: false }
    setTasks((prev) => [...prev, newTask])
    setNextId((n) => n + 1)
    setTimeout(() => newInputRef.current?.focus(), 50)
  }

  function toggleDone(id: number) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    )
  }

  function updateField(id: number, field: "text" | "due", value: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    )
  }

  const isLast = (id: number) => tasks[tasks.length - 1]?.id === id

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-muted/60">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
          Task Planner
        </span>
        <button
          onClick={addTask}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background transition-[background-color,transform] duration-200 hover:bg-emerald-700 active:scale-[0.96]"
          aria-label="Add task"
          style={{ minWidth: 32, minHeight: 32 }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto px-3 pb-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="grid items-center overflow-hidden rounded-xl border border-border/60 bg-background transition-opacity duration-200"
            style={{
              gridTemplateColumns: "40px 1fr 52px",
              opacity: task.done ? 0.45 : 1,
            }}
          >
            <button
              onClick={() => toggleDone(task.id)}
              aria-label={task.done ? "Mark incomplete" : "Mark complete"}
              className="flex h-full w-full items-center justify-center"
              style={{ minHeight: 40 }}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-[background-color,border-color] duration-200"
                style={{
                  background: task.done ? "#10b981" : undefined,
                  borderColor: task.done ? "#10b981" : undefined,
                }}
              >
                {task.done && (
                  <svg
                    viewBox="0 0 10 8"
                    fill="none"
                    className="h-2.5 w-2.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 4l3 3 5-6"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </button>

            <input
              ref={isLast(task.id) ? newInputRef : undefined}
              type="text"
              value={task.text}
              onChange={(e) => updateField(task.id, "text", e.target.value)}
              placeholder="Task..."
              className="w-full bg-transparent px-1.5 py-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
              style={{
                textDecoration: task.done ? "line-through" : "none",
              }}
            />

            <input
              type="text"
              value={task.due}
              onChange={(e) => updateField(task.id, "due", e.target.value)}
              placeholder="00/00"
              className="w-full border-l border-border/60 bg-transparent px-1.5 py-2.5 text-center font-mono text-[11px] text-muted-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
