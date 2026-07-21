import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import CashSession from '#models/cash_session'
import InvoicePayment from '#models/invoice_payment'
import OrderReturn from '#models/order_return'
import type User from '#models/user'
import { audit } from '#services/audit'
import { nextDocNumber } from '#services/numbering'
import { DomainError } from '#services/domain_errors'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type CashSessionSummary = {
  byMethod: Record<string, number>
  salesCount: number
  openingFloat: number
  expectedCash: number
}

/** The single open cash session (POS register), or null if it's closed. */
export async function getOpenSession(): Promise<CashSession | null> {
  return CashSession.query().where('status', 'open').first()
}

/**
 * Open the register with a starting float. Only one session may be open at
 * a time — the open-session row (if any) is locked first so concurrent
 * open attempts serialize instead of racing.
 */
export async function openSession(input: {
  openingFloat: number
  actor: User
}): Promise<CashSession> {
  return db.transaction(async (trx) => {
    const existing = await CashSession.query({ client: trx })
      .where('status', 'open')
      .forUpdate()
      .first()
    if (existing) {
      throw new DomainError({
        code: 'SESSION_ALREADY_OPEN',
        message: 'A cash session is already open — close it before opening a new one.',
      })
    }

    const session = new CashSession()
    session.number = await nextDocNumber('CS', trx)
    session.status = 'open'
    session.openedByUserId = input.actor.id
    session.openedAt = DateTime.now()
    session.openingFloat = String(round2(input.openingFloat))
    session.useTransaction(trx)
    await session.save()

    await audit({
      actor: input.actor,
      action: 'pos.session_open',
      targetType: 'cash_session',
      targetId: session.id,
      payload: { openingFloat: round2(input.openingFloat) },
      trx,
    })

    return session
  })
}

/**
 * Close the open register and produce a Z-report: expected cash on hand is
 * the opening float plus cash payments taken during the session, minus cash
 * refunds issued during the session window. Variance is counted minus
 * expected.
 */
export async function closeSession(input: {
  countedCash: number
  note?: string | null
  actor: User
}): Promise<CashSession> {
  return db.transaction(async (trx) => {
    const session = await CashSession.query({ client: trx })
      .where('status', 'open')
      .forUpdate()
      .first()
    if (!session) {
      throw new DomainError({
        code: 'NO_OPEN_SESSION',
        message: 'There is no open cash session to close.',
      })
    }

    const cashInRow = await InvoicePayment.query({ client: trx })
      .where('cash_session_id', session.id)
      .where('method', 'cash')
      .sum('amount as total')
      .first()
    const cashIn = Number(cashInRow?.$extras.total ?? 0)

    // order_returns has no cash_session_id column, so cash refunds during
    // this session are approximated by a time window (refunds recorded
    // since the session opened) rather than an exact session link.
    const refundsRow = await OrderReturn.query({ client: trx })
      .where('refund_method', 'cash')
      .where('created_at', '>=', session.openedAt.toSQL()!)
      .sum('refund_amount as total')
      .first()
    const cashRefunds = Number(refundsRow?.$extras.total ?? 0)

    const openingFloat = Number(session.openingFloat)
    const expected = round2(openingFloat + cashIn - cashRefunds)
    const variance = round2(input.countedCash - expected)

    session.status = 'closed'
    session.closedByUserId = input.actor.id
    session.closedAt = DateTime.now()
    session.expectedCash = String(expected)
    session.countedCash = String(round2(input.countedCash))
    session.variance = String(variance)
    session.note = input.note ?? null
    session.useTransaction(trx)
    await session.save()

    await audit({
      actor: input.actor,
      action: 'pos.session_close',
      targetType: 'cash_session',
      targetId: session.id,
      payload: { expected, counted: round2(input.countedCash), variance },
      trx,
    })

    return session
  })
}

/**
 * Live totals for the given (typically still-open) session, used to render
 * the POS session strip. `expectedCash` here is a running figure (opening
 * float + cash taken so far); the authoritative Z-report figure — which
 * also nets out cash refunds — is computed by `closeSession`.
 */
export async function getSessionSummary(session: CashSession): Promise<CashSessionSummary> {
  const rows = await InvoicePayment.query()
    .where('cash_session_id', session.id)
    .groupBy('method')
    .select('method')
    .sum('amount as total')
  const byMethod: Record<string, number> = {}
  for (const row of rows) {
    byMethod[row.method] = round2(Number(row.$extras.total))
  }

  const salesRow = await InvoicePayment.query()
    .where('cash_session_id', session.id)
    .countDistinct('invoice_id as count')
    .first()
  const salesCount = Number(salesRow?.$extras.count ?? 0)

  const openingFloat = Number(session.openingFloat)
  const expectedCash = round2(openingFloat + (byMethod.cash ?? 0))

  return { byMethod, salesCount, openingFloat, expectedCash }
}
