import type { Metadata } from "next"

import { RegisterDeliveryBoy } from "@/features/delivery-men/components/register-delivery-boy"

export const metadata: Metadata = {
  title: "Add delivery boy",
}

// Data comes from the seller delivery-men API, which checks the "delivery" permission and the restaurant.
export default function AddDeliveryBoyPage() {
  return <RegisterDeliveryBoy />
}
