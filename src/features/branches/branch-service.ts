import { api } from "@/lib/api-client"

import type { Branch, BranchChanges, BranchInput } from "./types"

// Requests are scoped to the active restaurant (X-Seller-Id); the API checks the owner may use it.
const PATH = "/seller/branches"
const SCOPED = { restaurantScoped: true } as const

export async function listBranches(): Promise<Branch[]> {
  return (await api<{ branches: Branch[] }>(PATH, SCOPED)).branches
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  return (await api<{ branch: Branch }>(PATH, { method: "POST", body: input, ...SCOPED })).branch
}

export async function updateBranch(id: number, changes: BranchChanges): Promise<Branch> {
  return (await api<{ branch: Branch }>(`${PATH}/${id}`, { method: "PATCH", body: changes, ...SCOPED })).branch
}
