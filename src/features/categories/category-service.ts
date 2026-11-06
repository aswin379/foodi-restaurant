import { http } from "@/lib/http"
import type { Category, CategoryInput } from "./types"

const PATH = "/seller/categories"
const SCOPED = { restaurantScoped: true } as const

export async function listCategories(): Promise<Category[]> {
  return (await http.get<{ categories: Category[] }>(PATH, SCOPED)).categories
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  return (await http.post<{ category: Category }>(PATH, input, SCOPED)).category
}

export async function updateCategory(id: number, input: CategoryInput): Promise<Category> {
  return (await http.patch<{ category: Category }>(`${PATH}/${id}`, input, SCOPED)).category
}

export async function setCategoryStatus(id: number, isActive: boolean): Promise<Category> {
  return (await http.patch<{ category: Category }>(`${PATH}/${id}/status`, { isActive }, SCOPED)).category
}

