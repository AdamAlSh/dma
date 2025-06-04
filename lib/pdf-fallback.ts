"use server"

// Multiple PDF extraction strategies for better compatibility
export async function extractPDFTextFallback(buffer: Buffer): Promise<string> {
  console.log(`[PDF Fallback] Starting extraction for buffer size: ${buffer.length}`)

  const errors: string[] = []

  // Strategy 1: Try unpdf (works well in development)
  try {
    console.log("[PDF Fallback] Attempting unpdf extraction...")
    const { extractText } = await import("unpdf")

    const { text } = await extractText(buffer, {
      mergePages: true,
    })

    if (text && text.trim().length > 0) {
      console.log(`[PDF Fallback] unpdf success: ${text.length} characters`)
      return text.trim()
    }

    throw new Error("unpdf returned empty text")
  } catch (error) {
    const errorMsg = `unpdf failed: ${error instanceof Error ? error.message : "Unknown error"}`
    console.log(`[PDF Fallback] ${errorMsg}`)
    errors.push(errorMsg)
  }

  // Strategy 2: Try pdf-parse (more reliable in serverless)
  try {
    console.log("[PDF Fallback] Attempting pdf-parse extraction...")
    const pdfParse = await import("pdf-parse/lib/pdf-parse.js")

    const data = await pdfParse.default(buffer)

    if (data.text && data.text.trim().length > 0) {
      console.log(`[PDF Fallback] pdf-parse success: ${data.text.length} characters`)
      return data.text.trim()
    }

    throw new Error("pdf-parse returned empty text")
  } catch (error) {
    const errorMsg = `pdf-parse failed: ${error instanceof Error ? error.message : "Unknown error"}`
    console.log(`[PDF Fallback] ${errorMsg}`)
    errors.push(errorMsg)
  }

  // Strategy 3: Try pdf2pic + OCR (for image-based PDFs)
  try {
    console.log("[PDF Fallback] Attempting image-based extraction...")

    // This would require additional setup for OCR
    // For now, we'll skip this but could implement with tesseract.js
    throw new Error("OCR extraction not implemented yet")
  } catch (error) {
    const errorMsg = `OCR extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
    console.log(`[PDF Fallback] ${errorMsg}`)
    errors.push(errorMsg)
  }

  // Strategy 4: Basic text extraction attempt
  try {
    console.log("[PDF Fallback] Attempting basic text extraction...")

    // Convert buffer to string and look for readable text
    const bufferString = buffer.toString("utf8")

    // Look for text patterns in PDF
    const textMatches = bufferString.match(/$$([^)]+)$$/g)

    if (textMatches && textMatches.length > 0) {
      const extractedText = textMatches
        .map((match) => match.slice(1, -1)) // Remove parentheses
        .filter((text) => text.length > 2) // Filter out short strings
        .join(" ")

      if (extractedText.length > 50) {
        console.log(`[PDF Fallback] Basic extraction success: ${extractedText.length} characters`)
        return extractedText
      }
    }

    throw new Error("No readable text found in PDF structure")
  } catch (error) {
    const errorMsg = `Basic extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
    console.log(`[PDF Fallback] ${errorMsg}`)
    errors.push(errorMsg)
  }

  // All strategies failed
  console.error("[PDF Fallback] All extraction strategies failed:", errors)

  throw new Error(
    `PDF text extraction failed. Tried multiple methods: ${errors.join("; ")}. This PDF may be image-based, corrupted, or use an unsupported format. Please try converting to Word document or copy-paste the text directly.`,
  )
}

// Helper function to validate PDF buffer - now async as required
export async function validatePDFBuffer(buffer: Buffer): Promise<{ isValid: boolean; error?: string }> {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: "Empty buffer" }
  }

  // Check PDF header
  const header = buffer.subarray(0, 8).toString("ascii")
  if (!header.startsWith("%PDF-")) {
    return { isValid: false, error: "Invalid PDF header" }
  }

  // Check minimum size (PDFs are typically at least 1KB)
  if (buffer.length < 1024) {
    return { isValid: false, error: "PDF file too small" }
  }

  return { isValid: true }
}
