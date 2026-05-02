import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AuditEvent from '#models/audit_event'
import type User from '#models/user'

export type AuditPayload = {
  actor: User | null
  action: string
  targetType?: string | null
  targetId?: number | null
  payload?: Record<string, unknown> | null
  trx?: TransactionClientContract
}

/**
 * Single writer for the audit_events table.
 *
 * State-transition services should call this immediately after they have
 * mutated the target row, inside the same transaction so the audit row is
 * rolled back if the operation fails.
 */
export async function audit(opts: AuditPayload): Promise<void> {
  const event = new AuditEvent()
  event.actorUserId = opts.actor?.id ?? null
  event.action = opts.action
  event.targetType = opts.targetType ?? null
  event.targetId = opts.targetId ?? null
  event.payload = opts.payload ?? null
  event.occurredAt = DateTime.now()
  if (opts.trx) event.useTransaction(opts.trx)
  await event.save()
}
