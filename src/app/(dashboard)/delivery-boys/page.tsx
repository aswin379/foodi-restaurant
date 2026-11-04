import type { Metadata } from "next"

import { DeliveryBoysManager } from "@/features/delivery-men/components/delivery-boys-manager"

export const metadata: Metadata = {
  title: "My delivery boys",
}

// Data comes from the seller delivery-men API, which checks the "delivery" permission and the restaurant.
export default function DeliveryBoysPage() {
  return <DeliveryBoysManager />
}
