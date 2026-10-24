export type OrdersErrorKind = "not_configured" | "unavailable"

export class OrdersServiceError extends Error {
  constructor(
    readonly kind: OrdersErrorKind,
    message: string = kind
  ) {
    super(message)
    this.name = "OrdersServiceError"
  }
}
