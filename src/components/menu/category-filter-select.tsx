"use client"

import { useState } from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MenuCategory } from "@/lib/menu/types"

const ALL = "all"

/** Category filter for the menu GET form. Radix can't select "", so "All categories" maps to an empty `category` param. */
export function CategoryFilterSelect({
  id,
  categories,
  defaultValue,
}: {
  id: string
  categories: MenuCategory[]
  defaultValue: string
}) {
  const [value, setValue] = useState(defaultValue || ALL)
  return (
    <>
      <input type="hidden" name="category" value={value === ALL ? "" : value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={id} className="h-10 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
