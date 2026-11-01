"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  loginRequest,
  logoutRequest,
  refreshSession,
  setAccessToken,
  setSessionLostHandler,
} from "@/lib/api-client"

import type { SellerUser } from "./types"

type AuthState = {
  status: "loading" | "authenticated" | "anonymous"
  user: SellerUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Staff finished the forced password change. */
  markPasswordChanged: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading")
  const [user, setUser] = useState<SellerUser | null>(null)

  const clear = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus("anonymous")
  }, [])

  // The access token is memory-only, so a reload restores the session from the refresh cookie.
  useEffect(() => {
    setSessionLostHandler(clear)
    let active = true
    refreshSession()
      .then((session) => {
        if (!active) return
        setUser(session.user)
        setStatus("authenticated")
      })
      .catch(() => {
        if (active) clear()
      })
    return () => {
      active = false
      setSessionLostHandler(null)
    }
  }, [clear])

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginRequest(email, password)
    setUser(session.user)
    setStatus("authenticated")
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      clear()
    }
  }, [clear])

  const markPasswordChanged = useCallback(() => {
    setUser((current) => (current ? { ...current, mustChangePassword: false } : current))
  }, [])

  const value = useMemo(
    () => ({ status, user, login, logout, markPasswordChanged }),
    [status, user, login, logout, markPasswordChanged]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside AuthProvider")
  return context
}
