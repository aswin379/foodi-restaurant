import { api } from "@/lib/api-client"
import type { Category, CategoryInput } from "./types"

const PATH = "/seller/categories"
const SCOPED = { restaurantScoped: true } as const

export async function listCategories(): Promise<Category[]> {
  return (await api<{ categories: Category[] }>(PATH, SCOPED)).categories
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  return (await api<{ category: Category }>(PATH, { method: "POST", body: input, ...SCOPED })).category
}

export async function updateCategory(id: number, input: CategoryInput): Promise<Category> {
  return (await api<{ category: Category }>(`${PATH}/${id}`, { method: "PATCH", body: input, ...SCOPED })).category
}

export async function setCategoryStatus(id: number, isActive: boolean): Promise<Category> {
  return (await api<{ category: Category }>(`${PATH}/${id}/status`, { method: "PATCH", body: { isActive }, ...SCOPED })).category
}

