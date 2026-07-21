import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import IdempotencyKey from '#models/idempotency_key'
import type User from '#models/user'
import { DomainError } from '#services/domain_errors'

/** Sentinel response_status stored while the wrapped operation is running. */
const PROCESSING = 102

const DEFAULT_TTL_HOURS = 24

type IdempotencyOptions<T> = {
  actor: User
  route: string
  key: string
  ttlHours?: number
  run: () => Promise<T>
}

/**
 * Run `run` at most once per (actor, route, key). A retry with the same key
 * replays the stored result instead of re-executing; a concurrent duplicate
 * gets a 409 DomainError. Failed runs release the key so the user can retry.
 *
 * The claim happens in its own short transaction BEFORE `run` executes, so
 * a concurrent request sees the in-flight sentinel immediately.
 */
export async function withIdempotency<T>(
  opts: IdempotencyOptions<T>
): Promise<{ replayed: boolean; value: T }> {
  return attempt(opts, true)
}

async function attempt<T>(
  opts: IdempotencyOptions<T>,
  retryOnStale: boolean
): Promise<{ replayed: boolean; value: T }> {
  const ttlHours = opts.ttlHours ?? DEFAULT_TTL_HOURS
  const now = DateTime.now()

  // Claim phase: insert the processing sentinel. ON CONFLICT DO NOTHING keeps
  // a duplicate from aborting anything — we just learn we didn't claim it.
  const claimedId = await db.transaction(async (trx) => {
    // Opportunistic cleanup of expired keys for this route.
    await trx
      .from('idempotency_keys')
      .where('route', opts.route)
      .where('expires_at', '<', now.toJSDate())
      .delete()

    const inserted = await trx.rawQuery(
      `insert into idempotency_keys
         (actor_user_id, route, key, response_status, response_body, created_at, expires_at)
       values (?, ?, ?, ?, null, ?, ?)
       on conflict (actor_user_id, route, key) do nothing
       returning id`,
      [
        opts.actor.id,
        opts.route,
        opts.key,
        PROCESSING,
        now.toJSDate(),
        now.plus({ hours: ttlHours }).toJSDate(),
      ]
    )
    return (inserted.rows[0]?.id as number | undefined) ?? null
  })

  if (claimedId !== null) {
    let value: T
    try {
      value = await opts.run()
    } catch (err) {
      // Release the key so the user can retry after a failure.
      await IdempotencyKey.query().where('id', claimedId).delete()
      throw err
    }
    await IdempotencyKey.query()
      .where('id', claimedId)
      .update({
        response_status: 200,
        response_body: JSON.stringify(value ?? null),
      })
    return { replayed: false, value }
  }

  // Conflict: another request already holds (or held) this key.
  const existing = await IdempotencyKey.query()
    .where('actor_user_id', opts.actor.id)
    .where('route', opts.route)
    .where('key', opts.key)
    .first()

  if (!existing) {
    // The holder failed and released the key between our insert and select.
    if (retryOnStale) return attempt(opts, false)
    throw inFlightError()
  }

  if (existing.responseStatus === PROCESSING) {
    throw inFlightError()
  }

  if (existing.expiresAt.toMillis() < now.toMillis()) {
    await existing.delete()
    if (retryOnStale) return attempt(opts, false)
    throw inFlightError()
  }

  return { replayed: true, value: existing.responseBody as T }
}

function inFlightError(): DomainError {
  return new DomainError({
    code: 'DUPLICATE_REQUEST_IN_FLIGHT',
    message: 'This request is already being processed — please wait a moment.',
    status: 409,
  })
}
