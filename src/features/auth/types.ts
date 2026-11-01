/** The signed-in restaurant owner, as returned by `/seller/auth/login`, `/refresh` and `/me`. */
export type SellerUser = {
  id: number
  /** Owners manage every restaurant they own; staff are confined to the one they are assigned to. */
  role: "owner" | "staff"
  /** Staff only: the job title (it grants nothing) and the permissions the owner granted. */
  designation?: string
  permissions?: string[]
  /** Staff only: true until they replace the password the owner chose. */
  mustChangePassword?: boolean
  firstName: string
  lastName: string
  email: string
  /** The owner's first restaurant. Use `restaurants` for the full list. */
  restaurant: { id: number; name: string }
  restaurants: Array<{ id: number; name: string; status: string }>
}

export type Session = {
  accessToken: string
  user: SellerUser
}
