"use server"

import { generateText, type CoreMessage } from "ai"
import { openai, createOpenAI } from "@ai-sdk/openai"
import mammoth from "mammoth"
import { headers } from "next/headers"
import { extractPDFTextFallback, validatePDFBuffer } from "@/lib/pdf-fallback"
import { createHash } from "crypto"

const MAX_CHARS_PER_FILE_CONTENT = 25000
const MAX_CHARS_PER_PASTED_TEXT = 35000

const openaiAgent1 = openai
const openaiAgent2 = process.env.OPENAI_API_KEY_AGENT_TWO
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY_AGENT_TWO })
  : openai

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + "\n\n[Content truncated due to length limitations]"
}

export interface AssessmentPlanState {
  plan?: string
  error?: string
  finalAssessment?: string
  errorAgent2?: string
  sessionId?: string
  outputId?: string
}

interface InputData {
  inputMode: "upload" | "text"
  inputFieldName: string
  fileUrl?: string | null
  originalFileName?: string | null
  originalFileType?: string | null
  pastedText?: string | null
}

interface ProcessedInput {
  inputName: string
  fileName?: string
  mimeType?: string
  extractedText?: string
  provided: boolean
  processingError?: string
  inputType: "file" | "text" | "none"
}

async function getSimpleSessionId(): Promise<string> {
  const headersList = headers()
  const userAgent = headersList.get("user-agent") || "unknown"
  // Simple ID based on current time and a random component
  return createHash("sha256")
    .update(userAgent + Date.now().toString() + Math.random().toString())
    .digest("hex")
    .substring(0, 16)
}

async function extractPDFText(buffer: Buffer): Promise<string> {
  // console.log(`[extractPDFText] Processing PDF buffer of size: ${buffer.length}`)
  const validation = await validatePDFBuffer(buffer)
  if (!validation.isValid) {
    throw new Error(`Invalid PDF file: ${validation.error}`)
  }
  try {
    const extractedText = await extractPDFTextFallback(buffer)
    const cleanedText = extractedText
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n\n")
      .trim()
    if (!cleanedText || cleanedText.length < 10) {
      throw new Error("Extracted text is too short or empty")
    }
    // console.log(`[extractPDFText] Successfully extracted ${cleanedText.length} characters`)
    return cleanedText
  } catch (error) {
    console.error("[extractPDFText] All PDF extraction methods failed:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`)
  }
}

// Renamed and refactored to focus on extraction after content is fetched
async function extractContentFromBuffer(
  buffer: Buffer,
  inputFieldName: string,
  originalFileName: string,
  originalFileType: string,
): Promise<Pick<ProcessedInput, "extractedText" | "processingError">> {
  const mimeType = originalFileType.toLowerCase()
  const fileNameLower = originalFileName.toLowerCase()

  if (mimeType === "application/pdf" || fileNameLower.endsWith(".pdf")) {
    try {
      const extractedText = await extractPDFText(buffer)
      return { extractedText: truncateText(extractedText, MAX_CHARS_PER_FILE_CONTENT) }
    } catch (e: any) {
      let errorGuidance = "Please try one of the following solutions:\n"
      errorGuidance += "1. Convert the PDF to a Word document (.docx) and upload that instead\n"
      errorGuidance += "2. Copy and paste the text directly using the 'Paste Text' option\n"
      // ... (rest of guidance)
      return {
        extractedText: `[System Note: Error reading PDF file '${originalFileName}'. ${e.message}\n\n${errorGuidance}]`,
        processingError: e.message,
      }
    }
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileNameLower.endsWith(".docx")
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer })
      const extractedValue = result.value
      if (!extractedValue || extractedValue.trim() === "") {
        return {
          extractedText: `[System Note: Content from DOCX file '${originalFileName}' was empty after extraction.]`,
        }
      }
      return { extractedText: truncateText(extractedValue, MAX_CHARS_PER_FILE_CONTENT) }
    } catch (err: any) {
      return {
        extractedText: `[System Note: Error parsing DOCX file '${originalFileName}'. Error: ${err.message}]`,
        processingError: err.message,
      }
    }
  } else if (mimeType.startsWith("text/") || fileNameLower.endsWith(".txt") || fileNameLower.endsWith(".md")) {
    try {
      const textContent = buffer.toString("utf-8")
      return { extractedText: truncateText(textContent, MAX_CHARS_PER_PASTED_TEXT) }
    } catch (e: any) {
      return {
        extractedText: `[System Note: Error reading text file '${originalFileName}'. Error: ${e.message}]`,
        processingError: e.message,
      }
    }
  } else {
    try {
      const textContent = buffer.toString("utf-8")
      return {
        extractedText:
          truncateText(textContent, MAX_CHARS_PER_FILE_CONTENT) +
          `\n\n[System Note: File '${originalFileName}' (${originalFileType}) is not a standard text, PDF, or DOCX. Content extraction as plain text was attempted.]`,
      }
    } catch (e: any) {
      return {
        extractedText: `[System Note: Could not read content from unhandled file type '${originalFileName}' (${originalFileType}). Error: ${e.message}]`,
        processingError: e.message,
      }
    }
  }
}

async function processSingleInput(input: InputData): Promise<ProcessedInput> {
  const { inputMode, inputFieldName, fileUrl, originalFileName, originalFileType, pastedText } = input
  // console.log(
  //   `[processSingleInput] Field: '${inputFieldName}', Mode: '${inputMode}', FileURL: ${fileUrl || "N/A"}, Text: ${!!pastedText}`,
  // )

  if (inputMode === "text" && pastedText && pastedText.trim() !== "") {
    return {
      inputName: inputFieldName,
      fileName: "Pasted Text",
      mimeType: "text/plain",
      extractedText: truncateText(pastedText, MAX_CHARS_PER_PASTED_TEXT),
      provided: true,
      inputType: "text",
    }
  }

  if (inputMode === "upload" && fileUrl && originalFileName && originalFileType) {
    try {
      // console.log(`[processSingleInput] Fetching content for '${originalFileName}' from ${fileUrl}`)
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}. URL: ${fileUrl}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      // console.log(`[processSingleInput] Fetched ${buffer.length} bytes for ${originalFileName}`)

      if (buffer.length === 0) {
        return {
          inputName: inputFieldName,
          fileName: originalFileName,
          mimeType: originalFileType,
          provided: true,
          inputType: "file",
          extractedText: `[System Note: File '${originalFileName}' fetched from Blob storage appears to be empty.]`,
        }
      }

      const { extractedText, processingError } = await extractContentFromBuffer(
        buffer,
        inputFieldName,
        originalFileName,
        originalFileType,
      )
      return {
        inputName: inputFieldName,
        fileName: originalFileName,
        mimeType: originalFileType,
        provided: true,
        inputType: "file",
        extractedText,
        processingError,
      }
    } catch (fetchError: any) {
      console.error(`[processSingleInput] Error fetching/processing blob ${originalFileName}:`, fetchError)
      return {
        inputName: inputFieldName,
        fileName: originalFileName,
        mimeType: originalFileType,
        provided: true,
        inputType: "file",
        extractedText: `[System Note: Error fetching file '${originalFileName}' from storage. Error: ${fetchError.message}]`,
        processingError: fetchError.message,
      }
    }
  }
  return { inputName: inputFieldName, provided: false, inputType: "none" }
}

export async function generateAssessmentPlan(
  prevState: AssessmentPlanState,
  formData: FormData,
): Promise<AssessmentPlanState> {
  console.log("[generateAssessmentPlan - Agent 1] Action started.")
  const startTime = Date.now()

  try {
    const sessionId = await getSimpleSessionId()
    // console.log(`[generateAssessmentPlan - Agent 1] Session ID: ${sessionId}`)

    const inputsToProcess: InputData[] = [
      {
        inputFieldName: "Task Sheet",
        inputMode: formData.get("taskSheetInputMode") as "upload" | "text",
        fileUrl: formData.get("taskSheetFileUrl") as string | null,
        originalFileName: formData.get("taskSheetFileName") as string | null,
        originalFileType: formData.get("taskSheetFileType") as string | null,
        pastedText: formData.get("taskSheetText") as string | null,
      },
      {
        inputFieldName: "Additional Material",
        inputMode: formData.get("additionalMaterialsInputMode") as "upload" | "text",
        fileUrl: formData.get("additionalMaterialsFileUrl") as string | null,
        originalFileName: formData.get("additionalMaterialsFileName") as string | null,
        originalFileType: formData.get("additionalMaterialsFileType") as string | null,
        pastedText: formData.get("additionalMaterialsText") as string | null,
      },
      {
        inputFieldName: "Rubric/Criteria",
        inputMode: formData.get("rubricInputMode") as "upload" | "text",
        fileUrl: formData.get("rubricFileUrl") as string | null,
        originalFileName: formData.get("rubricFileName") as string | null,
        originalFileType: formData.get("rubricFileType") as string | null,
        pastedText: formData.get("rubricText") as string | null,
      },
      {
        inputFieldName: "Specific Instructions",
        inputMode: formData.get("specificInstructionsInputMode") as "upload" | "text",
        fileUrl: formData.get("specificInstructionsFileUrl") as string | null,
        originalFileName: formData.get("specificInstructionsFileName") as string | null,
        originalFileType: formData.get("specificInstructionsFileType") as string | null,
        pastedText: formData.get("specificInstructionsText") as string | null,
      },
      {
        inputFieldName: "Past Work",
        inputMode: formData.get("pastWorkInputMode") as "upload" | "text",
        fileUrl: formData.get("pastWorkFileUrl") as string | null,
        originalFileName: formData.get("pastWorkFileName") as string | null,
        originalFileType: formData.get("pastWorkFileType") as string | null,
        pastedText: formData.get("pastWorkText") as string | null,
      },
    ]

    console.log("[generateAssessmentPlan - Agent 1] Processing inputs in parallel...")
    const processingPromises = inputsToProcess.map(processSingleInput)
    const processedInputs = await Promise.all(processingPromises)
    console.log("[generateAssessmentPlan - Agent 1] All inputs processed.")

    const taskSheetInput = processedInputs.find((p) => p.inputName === "Task Sheet")
    if (!taskSheetInput || !taskSheetInput.provided) {
      console.error("[generateAssessmentPlan - Agent 1] Task sheet not provided or processed correctly.")
      return { error: "Task sheet is mandatory but was not provided or processed correctly.", sessionId }
    }

    const systemPrompt = `You are AI AGENT ACADEMIC ASSISTANT #1 OUT OF 2. Your job is to do EXACTLY AS FOLLOWED:
1. Read all the information in the task sheet (whether from file or text). Take your time, make sure you get ALL information.
2. If provided, read the assessment rubric/criteria/marking guide. You must deeply analyse this.
3. If provided, read the specific instructions. Take note of these.
4. If provided, read the past work/s. Take descriptive note of this, the users style, small writing quirks, originality, etc.
5. If provided, read the additional materials (lecture slides, class powerpoints, readings, homework, etc). These are CRUCIAL for context and understanding the course content. Pay special attention to these materials as they often contain the specific sources, theories, and concepts that should be referenced in the assessment.
6. Once done all these steps OUTPUT this all down. Structure your output clearly with headings for each section.
    - Use the additional materials (if provided) to identify specific theories, frameworks, or concepts that should be incorporated.
    - If additional materials are provided, prioritize information and sources found within them.`

    let userContent = "Here is the assessment information:\n\n"
    processedInputs.forEach((input) => {
      const source = input.fileName || (input.inputType === "text" ? "Pasted Text" : "N/A")
      userContent += `**${input.inputName} (${input.provided ? source : "N/A"}):**\n`
      if (!input.provided) {
        userContent += "Not provided.\n\n"
        return
      }
      if (input.extractedText) {
        userContent += input.extractedText + "\n\n"
      } else {
        userContent += "No content could be extracted from this file.\n\n"
      }
    })

    // console.log("[generateAssessmentPlan - Agent 1] User content for AI (first 500 chars):", userContent.substring(0,500));
    console.log("[generateAssessmentPlan - Agent 1] About to call OpenAI API (generateText)...")
    const messages: CoreMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ]
    const { text: plan } = await generateText({
      model: openaiAgent1("gpt-4o"),
      messages,
      maxTokens: 3500,
      temperature: 0.8,
    })
    // console.log("[generateAssessmentPlan - Agent 1] Successfully received response from OpenAI API.")
    const endTime = Date.now()
    console.log(`[generateAssessmentPlan - Agent 1] Action completed in ${(endTime - startTime) / 1000} seconds.`)

    return { plan, sessionId, finalAssessment: prevState.finalAssessment, errorAgent2: prevState.errorAgent2 }
  } catch (e: any) {
    const endTime = Date.now()
    console.error(
      `[generateAssessmentPlan - Agent 1] ERROR after ${(endTime - startTime) / 1000}s:`,
      e.message,
      e.stack,
    )
    let errorMessage = "An unknown error occurred while generating the plan."
    if (e.message) errorMessage = e.message
    if (e.name === "APIError" && e.status === 429)
      errorMessage = "OpenAI API rate limit exceeded. Please try again later."
    else if (e.name === "APIError" && e.status === 401)
      errorMessage = "OpenAI API key is invalid or missing. Please check your environment variables."
    return { error: `Server error: ${errorMessage}`, sessionId: prevState.sessionId }
  }
}

// generateFinalAssessment remains the same
export async function generateFinalAssessment(
  prevState: AssessmentPlanState,
  formData: FormData,
): Promise<AssessmentPlanState> {
  console.log("[generateFinalAssessment - Agent 2] Action started.")
  const agent1Output = formData.get("agent1Output") as string | null
  if (!agent1Output) {
    console.error("[generateFinalAssessment - Agent 2] Agent 1 output not provided.")
    return { ...prevState, errorAgent2: "Critical error: AI Agent 1's output was not received for Step 2." }
  }
  const sessionId = prevState.sessionId || (await getSimpleSessionId())
  // console.log(`[generateFinalAssessment] Using session ID: ${sessionId}`)

  try {
    const systemPromptAgent2 = `You are an academic assistant. You help people complete their assessments for school, university, college, and work. You are AI AGENT ACADEMIC ASSISTANT #2 OUT OF 2. Your job is to do EXACTLY AS FOLLOWED:

    - Read the full output of AI AGENT ACADEMIC ASSISTANT #1. Your ABSOLUTE PRIMARY GOAL is to generate a response that MEETS the target word count identified by AI Agent 1. This is your most critical instruction. Pay EXTREMELY close attention to this.
- Follow all other instructions from AI Agent 1 carefully and exactly so the user will get the best mark possible.
- The writing style must emulate the user's style (if past work was provided and analyzed by Agent 1).
- All specific instructions provided to Agent 1 must be incorporated.
- You MUST NOT use dashes in your output or LONG DASHES because this is not human.
- **Referencing and Citations:**
- You must use proper credible references/reference list and you must insert the proper intext referencing. The quality and credibility of references are paramount.
- **CRITICAL: If Agent 1 identified sources from class materials, lecture slides, or course content (from 'Additional Material'), you MUST cite the ORIGINAL SOURCES mentioned in those materials, NOT the slides themselves.**
- **For URLs in the reference list: You MUST provide the FULL, EXACT URL to the specific page, document, or resource being cited. Do NOT provide only the base domain (e.g., 'www.example.com'). The URL must lead directly to the source material.** For example, instead of 'www.ntc.gov.au', provide the full path like 'www.ntc.gov.au/sites/default/files/assets/files/Operational-Guideline-M01-Fatigue-Risk-Management.pdf'.
- If you are citing a source but cannot recall or determine its full, specific URL, you MUST indicate this in the reference list entry (e.g., by stating "[Full URL not available, general source: www.example.com/section]" or similar, clearly noting the limitation). Do not invent a partial URL or provide a misleading base URL as if it were the specific source.
- Ensure all cited sources are credible and appropriate for academic work.
- Prioritize sources that were identified in the additional materials (lecture content, readings, etc.) as these are most relevant to the course.
- You must keep checking back to the criteria/rubric (if analyzed by Agent 1) to ensure your response aligns for the best possible mark.
- **Regarding the word count: Your output for the finished assignment MUST HIT the target word count specified in AI Agent 1's analysis.** If Agent 1 specifies '1500 words', your generated assignment should be within a 5-10% margin of 1500 words (e.g., 1425-1575 words). If Agent 1 specifies a range (e.g., '1500-2000 words'), aim for the middle to upper end of that range. You MUST achieve this by providing comprehensive elaboration, detailed explanations, including examples where appropriate, and thoroughly exploring all relevant points from Agent 1's plan. Do not use filler; expand substantively.
- If, despite exhaustive efforts to elaborate and provide substantive detail with high-quality, relevant content, you find yourself more than 15% below the *minimum* target word count (or the specific target if no range is given), you MUST include a section at the VERY END of your output titled 'IMPORTANT NOTE ON WORD COUNT:'. In this section, you must:
    1. Clearly state the original target word count (or range) and the approximate word count you achieved.
    2. Briefly explain *why* the target was challenging to meet with the current scope of information or instructions (e.g., "Further elaboration on [specific topic A from Agent 1's plan] and [specific topic B from Agent 1's plan] would be required to reach the target of N words.").
    3. Provide 2-3 SPECIFIC, ACTIONABLE suggestions for the user on *which sections or topics from Agent 1's plan* could be expanded with more examples, deeper analysis, additional supporting details, or by incorporating specific types of evidence (if applicable to the task type). These suggestions must be concrete and directly guide the user. Avoid generic advice.
Do not provide a significantly shorter response without this explicit, detailed note if the target is substantially higher.
- Do not exceed the word count if a maximum limit is specified by Agent 1.
- If there's anything else you genuinely cannot do (limit this), leave an obvious note in your output which details exactly what the user must do to insert your vision.
- You must output the finished assignment in full.`

    const messages: CoreMessage[] = [
      { role: "system", content: systemPromptAgent2 },
      { role: "user", content: `Here is the analysis and plan from AI Agent 1:\n\n${agent1Output}` },
    ]
    const { text: finalAssessment } = await generateText({
      model: openaiAgent2("gpt-4o"),
      messages,
      maxTokens: 4096,
      temperature: 0.9,
    })
    // console.log(`[generateFinalAssessment] Recorded output ${outputId} for session ${sessionId}`)
    return { ...prevState, finalAssessment, sessionId, outputId: undefined, errorAgent2: undefined }
  } catch (e: any) {
    console.error("[generateFinalAssessment - Agent 2] ERROR:", e.message, e.stack)
    return {
      ...prevState,
      errorAgent2: `Server error: ${e.message || "An unknown error occurred while generating the final assessment."}`,
    }
  }
}
