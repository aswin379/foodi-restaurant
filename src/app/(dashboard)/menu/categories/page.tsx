import type { Metadata } from "next"

import { CategoryList } from "@/features/categories/components/category-list"

export const metadata: Metadata = {
  title: "Categories",
}

export default function MenuCategoriesPage() {
  return <CategoryList />
}
