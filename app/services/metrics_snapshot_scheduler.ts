import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { writeDailySnapshot } from '#services/metrics_service'
import { isInfluxEnabled } from '#services/influx_service'

/**
 * Lightweight daily snapshot ticker. Mirrors job_auto_complete_scheduler:
 * web-process only, gated by SCHEDULER_ENABLED, interval timer with unref().
 *
 * It checks hourly and writes today's metrics snapshot at most once per
 * calendar day (re-writing today's point is idempotent in Influx, so the
 * once-per-day guard is just to avoid needless churn). External cron calling
 * `node ace metrics:snapshot` is an equally valid alternative.
 */
const TICK_INTERVAL_MS = 60 * 60 * 1000 // hourly
let timer: NodeJS.Timeout | null = null
let lastRunDate: string | null = null

export async function tick(): Promise<boolean> {
  const today = DateTime.now().toISODate()
  if (lastRunDate === today) return false
  const wrote = await writeDailySnapshot(DateTime.now())
  if (wrote) lastRunDate = today
  return wrote
}

export function start(): void {
  if (timer) return
  if (process.env.SCHEDULER_ENABLED !== 'true') {
    logger.info({ scheduler: 'metrics_snapshot' }, 'scheduler disabled (SCHEDULER_ENABLED!=true)')
    return
  }
  if (!isInfluxEnabled()) {
    logger.info({ scheduler: 'metrics_snapshot' }, 'scheduler skipped (InfluxDB disabled)')
    return
  }
  timer = setInterval(() => {
    tick().catch((err) => logger.error({ err }, 'metrics snapshot tick failed'))
  }, TICK_INTERVAL_MS)
  timer.unref?.()
  // Kick once on boot so a fresh day gets a point without waiting an hour.
  tick().catch((err) => logger.error({ err }, 'metrics snapshot initial tick failed'))
  logger.info({ scheduler: 'metrics_snapshot', intervalMs: TICK_INTERVAL_MS }, 'scheduler started')
}

export function stop(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
