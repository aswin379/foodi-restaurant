"use server"

import { redirect } from "next/navigation"

/**
 * Integration point for ending a restaurant session.
 *
 * Authentication isn't connected yet (see `authenticate.ts`), so no session
 * or cookie is ever created and there is nothing to clear here. Once the
 * Foodi auth backend exists, revoke the session with it and delete the
 * session cookie (via `cookies()` from `next/headers`) before redirecting.
 */
export async function signOut() {
  redirect("/login")
}
