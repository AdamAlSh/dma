"use client"

import type React from "react"
import { useRef, useState, type ChangeEvent, useEffect } from "react"
import { generateAssessmentPlan, generateFinalAssessment, type AssessmentPlanState } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Check, AlertCircle } from "lucide-react"
import InputSwitcher from "./components/input-switcher"
import { useLenis } from "@/app/contexts/lenis-context"
import ProgressBar from "./components/progress-bar"
import { upload } from "@vercel/blob/client"

type InputMode = "upload" | "text"

interface FileUploadState {
  url: string | null
  name: string | null
  type: string | null
  uploading: boolean
  error: string | null
}

const initialFileUploadState: FileUploadState = {
  url: null,
  name: null,
  type: null,
  uploading: false,
  error: null,
}

export default function AssessmentPage() {
  const [agent1State, setAgent1State] = useState<AssessmentPlanState>({})
  const [isAgent1Pending, setIsAgent1Pending] = useState(false)

  const [agent2Output, setAgent2Output] = useState<string | undefined>(undefined)
  const [isAgent2Pending, setIsAgent2Pending] = useState(false)
  const [agent2Error, setAgent2Error] = useState<string | undefined>(undefined)
  const [scrollToStartOpacity, setScrollToStartOpacity] = useState(1)
  const [showStickyHeader, setShowStickyHeader] = useState(false)

  const formRef = useRef<HTMLFormElement>(null)
  const agent1OutputCardRef = useRef<HTMLDivElement>(null)
  const agent2OutputCardRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  const { lenis } = useLenis()

  const [taskSheetMode, setTaskSheetMode] = useState<InputMode>("upload")
  const [taskSheetFile, setTaskSheetFile] = useState<FileUploadState>(initialFileUploadState)
  const [taskSheetText, setTaskSheetText] = useState("")

  const [additionalMaterialsMode, setAdditionalMaterialsMode] = useState<InputMode>("upload")
  const [additionalMaterialsFile, setAdditionalMaterialsFile] = useState<FileUploadState>(initialFileUploadState)
  const [additionalMaterialsText, setAdditionalMaterialsText] = useState("")

  const [rubricMode, setRubricMode] = useState<InputMode>("upload")
  const [rubricFile, setRubricFile] = useState<FileUploadState>(initialFileUploadState)
  const [rubricText, setRubricText] = useState("")

  const [specificInstructionsMode, setSpecificInstructionsMode] = useState<InputMode>("text")
  // Specific instructions likely won't be large files, so direct text or small upload is fine.
  // For consistency, we can use FileUploadState, but it might be overkill if only text is expected.
  // Let's keep it simple for now and assume it's primarily text.
  const [specificInstructionsFile, setSpecificInstructionsFile] = useState<FileUploadState>(initialFileUploadState)
  const [specificInstructionsText, setSpecificInstructionsText] = useState("")

  const [pastWorkMode, setPastWorkMode] = useState<InputMode>("upload")
  const [pastWorkFile, setPastWorkFile] = useState<FileUploadState>(initialFileUploadState)
  const [pastWorkText, setPastWorkText] = useState("")

  const handleFileUpload =
    (setter: React.Dispatch<React.SetStateAction<FileUploadState>>) => async (
      event: ChangeEvent<HTMLInputElement>
    ) => {
      const file = event.target.files?.[0]
      if (!file) {
        setter({ ...initialFileUploadState, error: "No file selected." })
        return
      }

      setter({ name: file.name, type: file.type, uploading: true, url: null, error: null })

      try {
        // Request a presigned upload URL from our API
        const presignRes = await fetch("/api/upload-blob", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathname: file.name, contentType: file.type }),
        })
        const { uploadUrl, tokenPayload } = await presignRes.json()

        // Upload the file directly to Blob storage
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
        })
        const blobResult = await uploadRes.json()

        setter({ name: file.name, type: file.type, url: blobResult.url, uploading: false, error: null })
        console.log(`File ${file.name} uploaded to ${blobResult.url}`)

        // Notify the server that the upload has completed
        await fetch("/api/upload-blob", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true, blob: blobResult, tokenPayload }),
        })
      } catch (error: any) {
        console.error("Error uploading file:", error)
        setter({
          name: file.name,
          type: file.type,
          uploading: false,
          url: null,
          error: error.message || "Upload failed",
        })
      }
    }

  const handleTextChange =
    (setter: React.Dispatch<React.SetStateAction<string>>) => (event: ChangeEvent<HTMLTextAreaElement>) => {
      setter(event.target.value)
    }

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const fadeDistance = 200
      const opacity = Math.max(0, 1 - scrollY / fadeDistance)
      setScrollToStartOpacity(opacity)
      if (headerRef.current) {
        const headerBottom = headerRef.current.offsetTop + headerRef.current.offsetHeight
        setShowStickyHeader(scrollY > headerBottom - 100)
      }
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (agent1State.plan && agent1OutputCardRef.current && lenis) {
      setTimeout(() => {
        if (agent1OutputCardRef.current && lenis) {
          lenis.scrollTo(agent1OutputCardRef.current, { offset: -20, duration: 2 })
        }
      }, 250)
    } else if (agent1State.plan && agent1OutputCardRef.current && !lenis) {
      agent1OutputCardRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [agent1State.plan, lenis])

  useEffect(() => {
    if (agent2Output && agent2OutputCardRef.current && lenis) {
      setTimeout(() => {
        if (agent2OutputCardRef.current && lenis) {
          lenis.scrollTo(agent2OutputCardRef.current, { offset: -20, duration: 2 })
        }
      }, 400)
    } else if (agent2Output && agent2OutputCardRef.current && !lenis) {
      agent2OutputCardRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [agent2Output, lenis])

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formRef.current) return

    setIsAgent1Pending(true)
    setAgent1State({}) // Clear previous state

    try {
      const formData = new FormData() // Don't use formRef.current directly

      // Helper to append data
      const appendInputData = (baseName: string, mode: InputMode, fileState: FileUploadState, textState: string) => {
        formData.append(`${baseName}InputMode`, mode)
        if (mode === "upload" && fileState.url) {
          formData.append(`${baseName}FileUrl`, fileState.url)
          formData.append(`${baseName}FileName`, fileState.name || "unknown_file")
          formData.append(`${baseName}FileType`, fileState.type || "application/octet-stream")
        } else if (mode === "text" && textState.trim() !== "") {
          formData.append(`${baseName}Text`, textState)
        }
      }

      appendInputData("taskSheet", taskSheetMode, taskSheetFile, taskSheetText)
      appendInputData("additionalMaterials", additionalMaterialsMode, additionalMaterialsFile, additionalMaterialsText)
      appendInputData("rubric", rubricMode, rubricFile, rubricText)
      appendInputData(
        "specificInstructions",
        specificInstructionsMode,
        specificInstructionsFile,
        specificInstructionsText,
      )
      appendInputData("pastWork", pastWorkMode, pastWorkFile, pastWorkText)

      const result = await generateAssessmentPlan(agent1State, formData)
      setAgent1State(result)
    } catch (error) {
      console.error("Error submitting form for Step 1:", error)
      setAgent1State((prev) => ({
        ...prev,
        error: "An unexpected error occurred during Step 1. Please try again.",
      }))
    } finally {
      setIsAgent1Pending(false)
    }
  }

  const handleStep2Submit = async () => {
    if (!agent1State.plan) {
      setAgent2Error("Cannot proceed to Step 2 without Step 1's output.")
      return
    }
    setIsAgent2Pending(true)
    setAgent2Error(undefined)
    setAgent2Output(undefined)

    const step2FormData = new FormData()
    step2FormData.append("agent1Output", agent1State.plan)

    const currentFullState: AssessmentPlanState = {
      plan: agent1State.plan,
      error: agent1State.error,
      finalAssessment: agent2Output,
      errorAgent2: agent2Error,
      sessionId: agent1State.sessionId,
    }

    try {
      const result = await generateFinalAssessment(currentFullState, step2FormData)
      if (result.finalAssessment) setAgent2Output(result.finalAssessment)
      if (result.errorAgent2) setAgent2Error(result.errorAgent2)
    } catch (e: any) {
      setAgent2Error(e.message || "An unexpected error occurred during Step 2.")
    } finally {
      setIsAgent2Pending(false)
    }
  }

  const allBenefits = [
    "100% Free",
    "Undetectable",
    "Versatile",
    "No Login Required",
    "Fast",
    "Understanding",
    "Your Originality",
    "Effective",
    "Grading",
    "Improvements",
    "No Usage Limits",
    "Critical Thinking",
    "Untraceable",
    "Privacy Protected",
    "No Plagiarism",
    "Proper Citations",
    "Easy to Use",
    "Secure Upload",
  ]
  const duplicatedBenefits = [...allBenefits, ...allBenefits]

  // Helper to render file input status
  const renderFileInputStatus = (fileState: FileUploadState, inputId: string) => {
    if (fileState.uploading) {
      return (
        <div className="text-xs text-sky-400 mt-1 flex items-center">
          <Loader2 className="h-3 w-3 animate-spin mr-1" /> Uploading {fileState.name}...
        </div>
      )
    }
    if (fileState.error) {
      return (
        <div className="text-xs text-red-400 mt-1 flex items-center">
          <AlertCircle className="h-3 w-3 mr-1" /> Error: {fileState.error}
        </div>
      )
    }
    if (fileState.url && fileState.name) {
      return (
        <div className="text-xs text-green-400 mt-1 flex items-center">
          <Check className="h-3 w-3 mr-1" /> {fileState.name} uploaded.
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white">
      <style jsx>{`
      @keyframes scrollUp { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
      .scroll-animation { animation: scrollUp 45s linear infinite; }
      .scroll-container { mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%); }
      .benefit-item { transition: opacity 0.8s ease-in-out; }
    `}</style>

      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 transition-transform duration-300 ${showStickyHeader ? "translate-y-0" : "-translate-y-full"}`}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              <span className="text-sky-400">domyassessment</span>
              <span className="text-white">.com.au</span>
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-7xl mx-auto">
          <header ref={headerRef} className="mb-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center min-h-screen">
              <div
                className="lg:col-span-8 flex flex-col justify-center"
                style={{ transform: "translateX(180px) translateY(-70px)" }}
              >
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-none text-left">
                  <div className="text-sky-400">domyassessment</div>
                  <div className="text-white">.com.au</div>
                </h1>
              </div>
              <div
                className="lg:col-span-4 flex justify-end items-center"
                style={{ transform: "translateX(-100px) translateY(-70px) scale(1.15)" }}
              >
                <div className="relative w-72 h-96 overflow-hidden scroll-container">
                  <div className="scroll-animation">
                    {duplicatedBenefits.map((benefit, index) => (
                      <div
                        key={index}
                        className="benefit-item flex items-center gap-3 px-4 py-3 mb-4 transition-colors duration-200"
                      >
                        <Check className="h-6 w-6 text-green-400 flex-shrink-0" />
                        <span className="font-semibold text-green-300 text-xl whitespace-nowrap">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div
              className="fixed bottom-8 left-1/2 transform -translate-x-1/2 text-white text-lg font-medium transition-opacity duration-300 pointer-events-none z-10"
              style={{ opacity: scrollToStartOpacity }}
            >
              Scroll to Start
            </div>
          </header>

          <div className="max-w-4xl mx-auto">
            <Card className="w-full bg-slate-800 border-slate-700 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Submit Your Assessment Details (Step 1)</CardTitle>
                <CardDescription className="text-slate-400">
                  Provide your task sheet, rubric, specific instructions, and any past work for analysis. Files are
                  uploaded securely.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleFormSubmit} ref={formRef}>
                <CardContent className="space-y-6">
                  <div>
                    <InputSwitcher
                      id="taskSheet"
                      label="Task Sheet"
                      defaultMode="upload"
                      currentMode={taskSheetMode}
                      setCurrentMode={setTaskSheetMode}
                      onFileChange={handleFileUpload(setTaskSheetFile)}
                      textValue={taskSheetText}
                      onTextChange={handleTextChange(setTaskSheetText)}
                      required={true}
                      fileInputDisabled={taskSheetFile.uploading}
                    />
                    {renderFileInputStatus(taskSheetFile, "taskSheet")}
                  </div>
                  <div>
                    <InputSwitcher
                      id="additionalMaterials"
                      label="Additional Material"
                      defaultMode="upload"
                      currentMode={additionalMaterialsMode}
                      setCurrentMode={setAdditionalMaterialsMode}
                      onFileChange={handleFileUpload(setAdditionalMaterialsFile)}
                      textValue={additionalMaterialsText}
                      onTextChange={handleTextChange(setAdditionalMaterialsText)}
                      required={false}
                      fileInputDisabled={additionalMaterialsFile.uploading}
                    />
                    {renderFileInputStatus(additionalMaterialsFile, "additionalMaterials")}
                    <p className="text-sm text-slate-400 mt-1 px-1">
                      (i.e. lecture slides, class powerpoints, readings, homework, etc., anything with context)
                    </p>
                  </div>
                  <div>
                    <InputSwitcher
                      id="rubric"
                      label="Rubric/Criteria/Marking Guide"
                      defaultMode="upload"
                      currentMode={rubricMode}
                      setCurrentMode={setRubricMode}
                      onFileChange={handleFileUpload(setRubricFile)}
                      textValue={rubricText}
                      onTextChange={handleTextChange(setRubricText)}
                      fileInputDisabled={rubricFile.uploading}
                    />
                    {renderFileInputStatus(rubricFile, "rubric")}
                  </div>
                  <div>
                    <InputSwitcher
                      id="specificInstructions"
                      label="Specific Instructions"
                      defaultMode="text"
                      currentMode={specificInstructionsMode}
                      setCurrentMode={setSpecificInstructionsMode}
                      onFileChange={handleFileUpload(setSpecificInstructionsFile)}
                      textValue={specificInstructionsText}
                      onTextChange={handleTextChange(setSpecificInstructionsText)}
                      fileInputDisabled={specificInstructionsFile.uploading}
                    />
                    {renderFileInputStatus(specificInstructionsFile, "specificInstructions")}
                  </div>
                  <div>
                    <InputSwitcher
                      id="pastWork"
                      label="Past Work"
                      defaultMode="upload"
                      currentMode={pastWorkMode}
                      setCurrentMode={setPastWorkMode}
                      onFileChange={handleFileUpload(setPastWorkFile)}
                      textValue={pastWorkText}
                      onTextChange={handleTextChange(setPastWorkText)}
                      fileInputDisabled={pastWorkFile.uploading}
                    />
                    {renderFileInputStatus(pastWorkFile, "pastWork")}
                  </div>
                </CardContent>
                <CardFooter className="flex items-center gap-4">
                  <Button
                    type="submit"
                    disabled={
                      isAgent1Pending ||
                      isAgent2Pending ||
                      taskSheetFile.uploading ||
                      additionalMaterialsFile.uploading ||
                      rubricFile.uploading ||
                      pastWorkFile.uploading ||
                      specificInstructionsFile.uploading
                    }
                    className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isAgent1Pending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing Step 1...
                      </>
                    ) : (
                      "Do My Assessment - Step 1"
                    )}
                  </Button>
                  <ProgressBar isActive={isAgent1Pending} />
                </CardFooter>
              </form>
            </Card>

            {agent1State.error && (
              <Alert variant="destructive" className="mt-8 w-full bg-red-900 border-red-700 text-white">
                <AlertTitle className="font-semibold">Error (Step 1)</AlertTitle>
                <AlertDescription>{agent1State.error}</AlertDescription>
              </Alert>
            )}

            {agent1State.plan && (
              <Card ref={agent1OutputCardRef} className="mt-8 w-full bg-slate-800 border-slate-700 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Assessment Plan Output (Step 1)</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-slate-200 bg-slate-900 p-4 rounded-md text-sm leading-relaxed">
                    {agent1State.plan}
                  </pre>
                </CardContent>
                <CardFooter className="flex items-center gap-4">
                  <Button
                    onClick={handleStep2Submit}
                    disabled={isAgent2Pending || isAgent1Pending}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isAgent2Pending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing Step 2...
                      </>
                    ) : (
                      "Do My Assessment - Step 2"
                    )}
                  </Button>
                  <ProgressBar isActive={isAgent2Pending} />
                </CardFooter>
              </Card>
            )}

            {agent2Error && (
              <Alert variant="destructive" className="mt-8 w-full bg-red-900 border-red-700 text-white">
                <AlertTitle className="font-semibold">Error (Step 2)</AlertTitle>
                <AlertDescription>{agent2Error}</AlertDescription>
              </Alert>
            )}

            {agent2Output && (
              <Card ref={agent2OutputCardRef} className="mt-8 w-full bg-slate-800 border-slate-700 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Final Assessment Output (Step 2)</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-slate-200 bg-slate-900 p-4 rounded-md text-sm leading-relaxed">
                    {agent2Output}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
