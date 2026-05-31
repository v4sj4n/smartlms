"use client"

import { useState } from "react"
import { Lightbulb } from "lucide-react"

const QUOTES = [
  "Teaching is the greatest act of optimism. Your impact is immeasurable.",
  "The best teachers teach from the heart, not from the book. Trust your instincts.",
  "Every student is a story waiting to be written. You're holding the pen.",
  "Small progress is still progress. Celebrate every breakthrough.",
  "Your guidance today shapes their tomorrow. Keep inspiring.",
  "Great educators are patient gardeners. Trust the growth process.",
  "Questions are the seeds of learning. Encourage curiosity always.",
  "You don't just teach subjects, you teach people. Remember that.",
]

export function ProfessorAffirmationCard() {
  const [idx, setIdx] = useState(() =>
    Math.floor(Math.random() * QUOTES.length)
  )
  const [fading, setFading] = useState(false)

  function flip() {
    setFading(true)
    setTimeout(() => {
      setIdx((prev) => {
        let next
        do {
          next = Math.floor(Math.random() * QUOTES.length)
        } while (next === prev)
        return next
      })
      setFading(false)
    }, 300)
  }

  return (
    <button
      onClick={flip}
      className="group relative w-full overflow-hidden rounded-2xl bg-[#1A2332] p-5 text-left transition-[transform,opacity] duration-150 active:scale-[0.96] dark:bg-[#0f1419]"
      aria-label="Tap to refresh affirmation"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(59,130,246,0.35), transparent 60%)",
        }}
      />
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#60A5FA] uppercase">
            <Lightbulb className="h-3 w-3" />
            Teaching Insight
          </span>
          <span className="text-[10px] font-medium tracking-wide text-white/30">
            Tap to refresh
          </span>
        </div>
        <p
          className="font-serif text-base leading-relaxed text-pretty text-white transition-opacity duration-300"
          style={{ opacity: fading ? 0 : 1 }}
        >
          {QUOTES[idx]}
        </p>
      </div>
    </button>
  )
}
