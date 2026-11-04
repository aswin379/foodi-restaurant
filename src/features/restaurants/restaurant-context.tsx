"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { useAuth } from "@/features/auth/auth-context"
import { setActiveRestaurantId } from "@/lib/http"

import { listRestaurants } from "./restaurant-service"
import type { Restaurant } from "./types"

type RestaurantState = {
  status: "loading" | "ready" | "error"
  restaurants: Restaurant[]
  /** The restaurant the dashboards act on. Always an approved one, or null. */
  active: Restaurant | null
  select: (id: number) => void
  reload: () => Promise<void>
}

const STORAGE_KEY = "foodi.activeRestaurant"
const RestaurantContext = createContext<RestaurantState | null>(null)

// Only a restaurant id is remembered (a convenience); the API re-checks access on every request.
function readStoredId(): number | null {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function storeId(id: number | null) {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, String(id))
  } catch {
    // Storage can be blocked; the choice just won't survive a reload.
  }
}

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus, user } = useAuth()
  // Staff cannot list restaurants: they have exactly the one they are assigned to, which sign-in returned.
  const assigned = user?.role === "staff" ? user.restaurants : null
  const [status, setStatus] = useState<RestaurantState["status"]>("loading")
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  // Read once on the client. It doesn't change the first render: no restaurants are loaded yet.
  const [selectedId, setSelectedId] = useState<number | null>(() =>
    typeof window === "undefined" ? null : readStoredId()
  )

  const reload = useCallback(async () => {
    try {
      setRestaurants(await listRestaurants())
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [])

  // Load once signed in; ignore a response that arrives after sign-out.
  useEffect(() => {
    if (authStatus !== "authenticated" || assigned) return
    let alive = true
    listRestaurants()
      .then((list) => {
        if (!alive) return
        setRestaurants(list)
        setStatus("ready")
      })
      .catch(() => {
        if (alive) setStatus("error")
      })
    return () => {
      alive = false
    }
  }, [authStatus, assigned])

  // Signing out must not leave one owner's restaurants visible to the next person.
  const signedIn = authStatus === "authenticated"
  const visible = useMemo(() => {
    if (!signedIn) return []
    if (assigned) {
      return assigned.map(
        (r): Restaurant => ({
          id: r.id,
          name: r.name,
          logoUrl: null,
          status: r.status,
          isOperational: r.status === "APPROVED",
          subscriptionStatus: null,
          subscriptionExpiresOn: null,
        })
      )
    }
    return restaurants
  }, [signedIn, assigned, restaurants])
  const operational = useMemo(() => visible.filter((r) => r.isOperational), [visible])
  // The remembered restaurant if it is still approved; otherwise the only approved one, else none.
  const active = useMemo(() => {
    const remembered = operational.find((r) => r.id === selectedId)
    if (remembered) return remembered
    return operational.length === 1 ? (operational[0] ?? null) : null
  }, [operational, selectedId])

  // Set before children render so their first request already names the right restaurant.
  setActiveRestaurantId(active?.id ?? null)

  const select = useCallback((id: number) => {
    storeId(id)
    setSelectedId(id)
  }, [])

  const value = useMemo(
    () => ({ status: signedIn ? (assigned ? "ready" : status) : "loading", restaurants: visible, active, select, reload }),
    [signedIn, assigned, status, visible, active, select, reload]
  )
  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>
}

export function useRestaurants(): RestaurantState {
  const context = useContext(RestaurantContext)
  if (!context) throw new Error("useRestaurants must be used inside RestaurantProvider")
  return context
}
