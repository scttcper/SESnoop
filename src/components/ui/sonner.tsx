"use client"

import { Toaster as Sonner } from "sonner"

export function Toaster() {
  return (
    <Sonner
      closeButton
      richColors
      position="bottom-right"
      theme="dark"
    />
  )
}
