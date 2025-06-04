"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import Lenis from "@studio-freight/lenis"
import { LenisContext } from "@/app/contexts/lenis-context"

export default function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const [lenisInstance, setLenisInstance] = useState<Lenis | null>(null)
  // lenisRef is good for internal management within this component
  const internalLenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    // Initialize Lenis with minimal options to test scrollTo duration
    const lenis = new Lenis({
      // lerp: 0.1, // Default is 0.1
      // wheelMultiplier: 1, // Default is 1
      // smoothWheel: true, // Default is true
      // smoothTouch: false, // Default is false
      // syncTouch: true, // Default is false
      // touchInertiaMultiplier: 30, // Default is 35
    })
    internalLenisRef.current = lenis
    setLenisInstance(lenis) // Update context state

    console.log("[SmoothScrollProvider] Lenis initialized:", lenis)

    let animationFrameId: number | null = null
    function raf(time: number) {
      if (internalLenisRef.current) {
        internalLenisRef.current.raf(time)
      }
      animationFrameId = requestAnimationFrame(raf)
    }
    animationFrameId = requestAnimationFrame(raf)

    return () => {
      console.log("[SmoothScrollProvider] Cleaning up Lenis.")
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      if (internalLenisRef.current) {
        internalLenisRef.current.destroy()
        internalLenisRef.current = null
      }
      setLenisInstance(null)
    }
  }, [])

  return <LenisContext.Provider value={{ lenis: lenisInstance }}>{children}</LenisContext.Provider>
}
