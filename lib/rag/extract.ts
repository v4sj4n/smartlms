import mammoth from "mammoth"
import PDFParser from "pdf2json"

interface PDFTextItem {
  T: string
}

interface PDFText {
  R: PDFTextItem[]
}

interface PDFPage {
  Texts: PDFText[]
}

interface PDFData {
  Pages: PDFPage[]
}

type PDFErrorData = Error | { parserError: Error }

export async function extractTextByMimeType(input: {
  mimeType: string
  data: Buffer
}): Promise<string> {
  const { mimeType, data } = input

  if (mimeType === "application/pdf") {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser()
      let text = ""
      
      pdfParser.on("pdfParser_dataError", (errData: PDFErrorData) => {
        const error = errData instanceof Error ? errData : errData.parserError
        reject(error)
      })
      
      pdfParser.on("pdfParser_dataReady", (pdfData: PDFData) => {
        if (pdfData.Pages) {
          text = pdfData.Pages
            .map((page: PDFPage) => {
              if (page.Texts) {
                return page.Texts
                  .map((textItem: PDFText) => {
                    if (textItem.R && textItem.R.length > 0) {
                      return textItem.R
                        .map((r: PDFTextItem) => r.T || "")
                        .join(" ")
                    }
                    return ""
                  })
                  .join(" ")
              }
              return ""
            })
            .join("\n")
        }
        resolve(text || "")
      })
      
      pdfParser.parseBuffer(data)
    })
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
