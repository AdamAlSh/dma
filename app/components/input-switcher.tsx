"use client"

import type React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UploadCloud, TypeIcon } from "lucide-react"

type InputMode = "upload" | "text"

interface InputSwitcherProps {
  id: string
  label: string
  currentMode: InputMode
  setCurrentMode: (mode: InputMode) => void
  fileValue: File | null | undefined
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  textValue: string
  onTextChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  required?: boolean
  defaultMode: InputMode
}

export default function InputSwitcher({
  id,
  label,
  currentMode,
  setCurrentMode,
  fileValue,
  onFileChange,
  textValue,
  onTextChange,
  required = false,
  defaultMode,
}: InputSwitcherProps) {
  const handleModeChange = (value: string) => {
    setCurrentMode(value as InputMode)
  }

  return (
    <div>
      <Tabs value={currentMode} onValueChange={handleModeChange} defaultValue={defaultMode} className="w-full">
        <div className="flex justify-between items-center mb-2">
          <Label htmlFor={id + (currentMode === "upload" ? "File" : "Text")} className="text-slate-300 font-medium">
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          <TabsList className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-700 p-1 text-slate-400">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="upload"
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md p-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                      currentMode === "upload"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "hover:bg-slate-600 hover:text-slate-200",
                    )}
                    aria-label="Upload File"
                  >
                    <UploadCloud className="h-5 w-5" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700">
                  <p>Upload File</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="text"
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md p-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                      currentMode === "text"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "hover:bg-slate-600 hover:text-slate-200",
                    )}
                    aria-label="Paste Text"
                  >
                    <TypeIcon className="h-5 w-5" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700">
                  <p>Paste Text</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TabsList>
        </div>

        <TabsContent value="upload" className="mt-0 pt-0">
          <div className="relative">
            <Input
              id={id + "File"}
              name={id + "File"}
              type="file"
              onChange={onFileChange}
              className={cn(
                "bg-slate-700 text-white transition-colors",
                "h-[42px] flex items-center justify-start",
                "file:h-[30px] file:my-[6px] file:mx-[6px] file:mr-3",
                "file:text-slate-300 file:bg-slate-600 file:border-none file:px-3 file:rounded-md hover:file:bg-slate-500",
                "file:flex file:items-center file:justify-center file:font-medium file:text-sm",
                currentMode === "upload" ? "border-sky-500 border-2 ring-1 ring-sky-500/50" : "border-slate-600",
              )}
              style={{
                paddingTop: "0",
                paddingBottom: "0",
                paddingLeft: "0",
                paddingRight: "12px",
                display: "flex",
                alignItems: "center",
                height: "42px",
              }}
            />
          </div>
        </TabsContent>
        <TabsContent value="text" className="mt-0 pt-0">
          <Textarea
            id={id + "Text"}
            name={id + "Text"}
            value={textValue}
            onChange={onTextChange}
            placeholder={`Paste ${label.toLowerCase()} here...`}
            className={cn(
              "bg-slate-700 text-white min-h-[120px] p-3 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500",
              currentMode === "text"
                ? "border-sky-500 border-2 ring-1 ring-sky-500/50"
                : "border-slate-600 focus-visible:border-sky-500",
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
