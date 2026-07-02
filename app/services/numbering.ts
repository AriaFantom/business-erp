import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

/**
 * Gapless per-fiscal-year sequential document numbers.
 *
 * Result format: `${scope}-${year}-${nnnnnn}` (e.g. INV-2026-000123).
 *
 * Implementation: a single row in `doc_sequences` per (scope, year) is
 * locked + bumped via UPDATE … RETURNING. Concurrent inserts serialise on
 * the row lock, so the sequence is gapless even under contention.
 *
 * Must be called from inside the transaction that creates the document
 * row, so that a rolled-back insert does not consume a number.
 */
export type DocScope = 'INV' | 'QT' | 'PO' | 'JOB' | 'SO' | 'CN' | 'PRT' | 'ST' | 'CS'

export async function nextDocNumber(
  scope: DocScope,
  trx: TransactionClientContract,
  at: DateTime = DateTime.now()
): Promise<string> {
  const year = at.year

  // Upsert + lock the (scope, year) row. The CTE inserts a fresh row at 0
  // if missing, then the outer UPDATE … RETURNING bumps and returns the
  // new value. Postgres-specific: ON CONFLICT … DO NOTHING + RETURNING.
  await trx.rawQuery(
    `INSERT INTO doc_sequences (scope, year, last_number, created_at, updated_at)
     VALUES (?, ?, 0, NOW(), NOW())
     ON CONFLICT (scope, year) DO NOTHING`,
    [scope, year]
  )

  const result = await trx.rawQuery(
    `UPDATE doc_sequences
     SET last_number = last_number + 1, updated_at = NOW()
     WHERE scope = ? AND year = ?
     RETURNING last_number`,
    [scope, year]
  )

  const next = (result.rows?.[0]?.last_number ?? result[0]?.last_number) as number | string
  const num = typeof next === 'string' ? Number(next) : next
  return `${scope}-${year}-${String(num).padStart(6, '0')}`
}

/** Convenience helper that runs in its own transaction. Prefer the trx form. */
export async function nextDocNumberStandalone(scope: DocScope, at?: DateTime): Promise<string> {
  return db.transaction((trx) => nextDocNumber(scope, trx, at))
}
