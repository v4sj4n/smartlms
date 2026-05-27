"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

const QUOTES = [
  "Mistakes are proof that you are trying. Keep pushing forward.",
  "Focus on progress, not perfection. Every step counts.",
  "Your hard work today builds your genius tomorrow.",
  "Small steps every day add up to extraordinary achievements.",
  "You are entirely capable of mastering this — trust the process.",
  "Deep breaths. You've solved harder problems than this.",
  "The expert was once a beginner. Keep going.",
  "Consistency beats intensity every single time.",
]

export function AffirmationCard() {
  const [idx, setIdx] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line
    setIdx(Math.floor(Math.random() * QUOTES.length))
  }, [])

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
      {/* Radial gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(46,125,107,0.35), transparent 60%)",
        }}
      />
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#3BA38D]">
            <Sparkles className="h-3 w-3" />
            Daily Affirmation
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
