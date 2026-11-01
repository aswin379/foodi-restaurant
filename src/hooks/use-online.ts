"use client"

import { useEffect, useState } from "react"

/** Tracks the browser's online/offline state (assumed online until the first check). */
export function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    const first = setTimeout(update, 0)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      clearTimeout(first)
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])
  return online
}
