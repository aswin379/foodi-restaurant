import type { Metadata } from "next"

import { PageHeader } from "@/components/dashboard/page-header"
import { AddRestaurantForm } from "@/features/restaurants/components/add-restaurant-form"

export const metadata: Metadata = { title: "Add restaurant" }

export default function NewRestaurantPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Add restaurant" description="Apply for another restaurant under your account." />
      <AddRestaurantForm />
    </div>
  )
}
