"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface ProgressBarProps {
  isActive: boolean
  className?: string
}

export default function ProgressBar({ isActive, className }: ProgressBarProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isActive) {
      setProgress(0)
      return
    }

    // Start the progress animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Simulate realistic progress with varying speeds
        if (prev < 20) return prev + Math.random() * 3 + 1 // Fast start
        if (prev < 60) return prev + Math.random() * 2 + 0.5 // Medium speed
        if (prev < 85) return prev + Math.random() * 1 + 0.2 // Slower
        if (prev < 95) return prev + Math.random() * 0.5 + 0.1 // Very slow near end
        return Math.min(prev + 0.1, 98) // Cap at 98% until completion
      })
    }, 200)

    return () => clearInterval(interval)
  }, [isActive])

  // Reset to 100% briefly when becoming inactive (completion effect)
  useEffect(() => {
    if (!isActive && progress > 0) {
      setProgress(100)
      const timeout = setTimeout(() => setProgress(0), 500)
      return () => clearTimeout(timeout)
    }
  }, [isActive, progress])

  if (!isActive && progress === 0) return null

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-3 w-32 overflow-hidden rounded-full bg-slate-700 border border-slate-600">
        {/* Background track */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-700 to-slate-600" />

        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 via-blue-500 to-sky-400 transition-all duration-300 ease-out rounded-full shadow-sm"
          style={{ width: `${progress}%` }}
        />

        {/* Animated shimmer effect */}
        {isActive && (
          <div
            className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
            style={{
              left: `${Math.max(0, progress - 15)}%`,
              animation: progress > 5 ? "shimmer 2s ease-in-out infinite" : "none",
            }}
          />
        )}
      </div>

      {/* Progress text */}
      <span className="text-sm font-medium text-slate-300 min-w-[3rem] tabular-nums">{Math.round(progress)}%</span>
    </div>
  )
}
