import mammoth from "mammoth"

export async function extractTextByMimeType(input: {
  mimeType: string
  data: Buffer
}): Promise<string> {
  const { mimeType, data } = input

  if (mimeType === "application/pdf") {
    // TODO: wire a dedicated PDF parser compatible with your deployment target.
    // Keeping this no-op instead of brittle parsing avoids runtime crashes.
    return ""
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const parsed = await mammoth.extractRawText({ buffer: data })
    return parsed.value
  }

  if (mimeType === "text/plain") {
    return data.toString("utf-8")
  }

  // PPTX/images need specialized parsing; keep safe fallback now.
  return ""
}
