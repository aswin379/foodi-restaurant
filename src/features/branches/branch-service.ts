import { http } from "@/lib/http"

import type { Branch, BranchChanges, BranchInput } from "./types"

// Requests are scoped to the active restaurant (X-Seller-Id); the API checks the owner may use it.
const PATH = "/seller/branches"
const SCOPED = { restaurantScoped: true } as const

export async function listBranches(): Promise<Branch[]> {
  return (await http.get<{ branches: Branch[] }>(PATH, SCOPED)).branches
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  return (await http.post<{ branch: Branch }>(PATH, input, SCOPED)).branch
}

export async function updateBranch(id: number, changes: BranchChanges): Promise<Branch> {
  return (await http.patch<{ branch: Branch }>(`${PATH}/${id}`, changes, SCOPED)).branch
}
