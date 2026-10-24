export type MenuErrorKind = "not_configured" | "unavailable"

export class MenuServiceError extends Error {
  constructor(
    readonly kind: MenuErrorKind,
    message: string = kind
  ) {
    super(message)
    this.name = "MenuServiceError"
  }
}
