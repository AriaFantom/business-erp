/**
 * Service-layer error classes that controllers translate to user-friendly
 * 4xx responses (flash for Inertia, JSON for REST).
 *
 * The point is to draw a clear boundary between "input is invalid" (Vine
 * handles that with 422) and "the operation violates a domain rule" — the
 * latter never reaches Vine because it depends on DB state.
 */
export class DomainError extends Error {
  readonly status: number
  readonly code: string
  readonly field?: string

  constructor(opts: { code: string; message: string; status?: number; field?: string }) {
    super(opts.message)
    this.code = opts.code
    this.status = opts.status ?? 422
    this.field = opts.field
  }
}

export class InsufficientStockError extends DomainError {
  readonly available: number
  readonly requested: number
  readonly itemKind: string
  readonly itemId: number

  constructor(opts: { itemKind: string; itemId: number; available: number; requested: number }) {
    super({
      code: 'INSUFFICIENT_STOCK',
      field: 'qtyConsumed',
      message: `Insufficient stock: only ${opts.available} available, ${opts.requested} requested.`,
      status: 422,
    })
    this.itemKind = opts.itemKind
    this.itemId = opts.itemId
    this.available = opts.available
    this.requested = opts.requested
  }
}

export class InvalidStateError extends DomainError {
  constructor(opts: { entity: string; from: string; to: string }) {
    super({
      code: 'INVALID_STATE_TRANSITION',
      message: `Cannot transition ${opts.entity} from "${opts.from}" to "${opts.to}".`,
      status: 422,
    })
  }
}

export class OverpaymentError extends DomainError {
  constructor(opts: { remaining: number; attempted: number }) {
    super({
      code: 'OVERPAYMENT',
      field: 'amount',
      message: `Payment exceeds remaining balance (remaining ${opts.remaining}, attempted ${opts.attempted}).`,
      status: 422,
    })
  }
}
