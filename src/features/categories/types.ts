export interface Category {
  id: number
  name: string
  description: string | null
  isActive: boolean
  foodCount: number
  createdAt: string
}

export interface CategoryInput {
  name: string
  description?: string | null
}

