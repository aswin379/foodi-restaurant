/** A restaurant the signed-in owner may manage, as returned by `/seller/restaurants`. */
export type Restaurant = {
  id: number
  name: string
  logoUrl: string | null
  /** Application status: SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, CHANGES_REQUESTED or SUSPENDED. */
  status: string
  /** True only for APPROVED restaurants; everything else must not be presented as operational. */
  isOperational: boolean
  subscriptionStatus: string | null
  subscriptionExpiresOn: string | null
}

/** One restaurant with its application details, from `/seller/restaurants/:id` (any status). */
export type RestaurantDetail = Restaurant & {
  reviewReason: string | null
  /** A rejected application can be reopened for editing. */
  canReopen: boolean
  /** An application with requested changes can be edited and resubmitted. */
  canEdit: boolean
  description: string | null
  sellerTypeId: number
  cuisineIds: number[]
  tags: string[]
  address: string | null
  latitude: number | null
  longitude: number | null
  zoneName: string | null
  requestedZoneName: string | null
  prepTime: { unit: "min" | "hours"; min: number | null; max: number | null }
  coverUrl: string | null
  documents: { idDocumentType: string | null; hasIdDocument: boolean; hasTaxCertificate: boolean }
  submittedAt: string | null
}

export type Option = { id: number; name: string }
export type ApplicationOptions = {
  sellerTypes: Option[]
  cuisines: Option[]
  zones: Option[]
}

/** Optional ID and tax details, kept as form text; empty strings are dropped before sending. */
export type LegalInfo = {
  idDocumentType: string
  idNumber: string
  taxNumber: string
  taxNumberExpiresOn: string
}

export type RestaurantApplication = {
  sellerTypeId: number
  name: string
  cuisineIds: number[]
  address: string
  /** Either an existing zone or a requested new one (reviewed by an admin), never both. */
  zoneId?: number
  requestedZoneName?: string
  latitude: number
  longitude: number
  prepTimeUnit: "min" | "hours"
  prepTimeMin: number
  prepTimeMax: number
  legal?: {
    idDocumentType: string
    idNumber: string
    taxNumber?: string
    taxNumberExpiresOn?: string
  }
}

export type ApplicationImages = { logo: File; cover: File; idDocument?: File | null; taxCertificate?: File | null }

/** The sections an owner can correct once changes were requested. */
export type EditStep = "business" | "address" | "delivery" | "documents"
export type EditSlot = "logo" | "cover" | "id_document" | "tax_certificate"
