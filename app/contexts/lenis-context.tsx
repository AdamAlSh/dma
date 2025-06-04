"use client"
import { createContext, useContext } from "react"
import type Lenis from "@studio-freight/lenis"

interface LenisContextType {
  lenis: Lenis | null
}

export const LenisContext = createContext<LenisContextType | undefined>(undefined)

export function useLenis() {
  const context = useContext(LenisContext)
  if (context === undefined) {
    console.warn("useLenis must be used within a SmoothScrollProvider")
    return { lenis: null }
  }
  return context
}
