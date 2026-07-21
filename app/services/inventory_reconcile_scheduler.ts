import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { reconcileInventory } from '#services/reports_service'

/**
 * Daily inventory reconciliation ticker. Mirrors metrics_snapshot_scheduler:
 * web-process only, gated by SCHEDULER_ENABLED, interval timer with unref().
 *
 * It checks hourly and runs the reconcile at most once per calendar day.
 * On divergence it logs loudly but does NOT auto-repair — a human should
 * inspect why a service bypassed applyMovement. External cron calling
 * `node ace inventory:reconcile` is an equally valid alternative.
 */
const TICK_INTERVAL_MS = 60 * 60 * 1000 // hourly
let timer: NodeJS.Timeout | null = null
let lastRunDate: string | null = null

export async function tick(): Promise<boolean> {
  const today = DateTime.now().toISODate()
  if (lastRunDate === today) return false
  const result = await reconcileInventory()
  lastRunDate = today
  if (result.ok) {
    logger.info({ scheduler: 'inventory_reconcile' }, 'inventory reconciliation OK')
  } else {
    logger.error(
      { scheduler: 'inventory_reconcile', divergent: result.divergent },
      `inventory divergence found in ${result.divergent.length} item(s)`
    )
  }
  return true
}

export function start(): void {
  if (timer) return
  if (process.env.SCHEDULER_ENABLED !== 'true') {
    logger.info(
      { scheduler: 'inventory_reconcile' },
      'scheduler disabled (SCHEDULER_ENABLED!=true)'
    )
    return
  }
  timer = setInterval(() => {
    tick().catch((err) => logger.error({ err }, 'inventory reconcile tick failed'))
  }, TICK_INTERVAL_MS)
  timer.unref?.()
  // Kick once on boot so a fresh day gets checked without waiting an hour.
  tick().catch((err) => logger.error({ err }, 'inventory reconcile initial tick failed'))
  logger.info(
    { scheduler: 'inventory_reconcile', intervalMs: TICK_INTERVAL_MS },
    'scheduler started'
  )
}

export function stop(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
