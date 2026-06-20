import { describe, it, expect } from "vitest"

function keywordOverlap(a: string, b: string): number {
  const wordsA = new Set(
    a
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
  )
  const wordsB = b
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3)
  return wordsB.filter((w) => wordsA.has(w)).length
}

describe("quiz review keyword overlap", () => {
  it("matches related lecture titles to question content", () => {
    const question = "What is photosynthesis light-dependent reaction?"
    const material = "Photosynthesis Lecture: Light Reactions"
    expect(keywordOverlap(question, material)).toBeGreaterThan(0)
  })

  it("returns zero for unrelated content", () => {
    expect(keywordOverlap("Binary search trees", "Calculus integration")).toBe(
      0
    )
  })
})
