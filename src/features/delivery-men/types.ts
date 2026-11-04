export type DeliveryManType = "freelance" | "salary_based"
export type IdentityType = "national_id" | "passport" | "driving_license"
export type ApplicationStatus = "pending" | "approved" | "denied"
export type AccountStatus = "active" | "inactive" | "suspended"

/** A rider this restaurant registered (GET /seller/delivery-men). */
export type DeliveryBoy = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  phoneNumber: string
  identityDocumentType: IdentityType
  identityDocumentNumber: string
  zone: { id: number; name: string }
  vehicle: { id: number; name: string }
  deliveryManType: DeliveryManType
  applicationStatus: ApplicationStatus
  denialReason: string | null
  accountStatus: AccountStatus
  currentOrderCount: number
  createdAt: string
}

export type DeliveryBoyPage = { items: DeliveryBoy[]; page: number; pageSize: number; total: number }

export type DeliveryLookups = {
  /** The restaurant's own zone; riders are always placed in it. Null until the restaurant has a location. */
  zone: { id: number; name: string } | null
  vehicles: Array<{ id: number; name: string }>
  deliveryMode: "SELF" | "FOODI" | "PICKUP" | null
}

export type DeliveryBoyFile = {
  id: number
  kind: "profile" | "document"
  documentType: "identity" | "licence" | "other" | null
  mimeType: string
  sizeBytes: number
  status: "pending" | "verified" | "rejected"
  createdAt: string
}

export const DELIVERY_TYPES: Array<{ value: DeliveryManType; label: string }> = [
  { value: "freelance", label: "Freelance" },
  { value: "salary_based", label: "Salary based" },
]

export const IDENTITY_TYPES: Array<{ value: IdentityType; label: string }> = [
  { value: "national_id", label: "National ID" },
  { value: "passport", label: "Passport" },
  { value: "driving_license", label: "Driving license" },
]
