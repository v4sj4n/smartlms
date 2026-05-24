type ChunkMeta = {
  section?: string
  page?: number
}

export type TextChunk = {
  chunkIndex: number
  chunkText: string
  metadata: ChunkMeta
}

const WORDS_PER_CHUNK = 220
const WORD_OVERLAP = 40

export function cleanExtractedText(input: string): string {
  return input
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export function chunkAcademicText(text: string): TextChunk[] {
  const cleaned = cleanExtractedText(text)
  const words = cleaned.split(/\s+/).filter(Boolean)

  if (!words.length) return []

  const chunks: TextChunk[] = []
  let i = 0
  let chunkIndex = 0

  while (i < words.length) {
    const end = Math.min(i + WORDS_PER_CHUNK, words.length)
    const chunkWords = words.slice(i, end)

    chunks.push({
      chunkIndex,
      chunkText: chunkWords.join(" "),
      metadata: {},
    })

    chunkIndex += 1
    if (end === words.length) break
    i = end - WORD_OVERLAP
  }

  return chunks
}
