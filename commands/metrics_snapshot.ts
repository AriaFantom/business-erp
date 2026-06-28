import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import { snapshotRange, writeDailySnapshot } from '#services/metrics_service'
import { isInfluxEnabled } from '#services/influx_service'

/**
 * Daily metrics export Job. Rolls Postgres data into InfluxDB time-series
 * points consumed by the dashboard and profit report.
 *
 *   node ace metrics:snapshot                 # snapshot today
 *   node ace metrics:snapshot --backfill=365  # rebuild the trailing year
 *   node ace metrics:snapshot --from=2026-01-01 --to=2026-03-31
 *
 * Runs nightly via the in-app scheduler (see metrics_snapshot_scheduler.ts);
 * this command is for manual runs, backfills and external cron.
 */
export default class MetricsSnapshot extends BaseCommand {
  static commandName = 'metrics:snapshot'
  static description = 'Snapshot daily business metrics into InfluxDB'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.number({ description: 'Backfill this many trailing days (including today)' })
  declare backfill?: number

  @flags.string({ description: 'Start date (ISO, e.g. 2026-01-01) — used with --to' })
  declare from?: string

  @flags.string({ description: 'End date (ISO) — defaults to today when --from is given' })
  declare to?: string

  async run() {
    if (!isInfluxEnabled()) {
      this.logger.warning(
        'InfluxDB is disabled (INFLUX_ENABLED!=true or unconfigured) — nothing written.'
      )
      return
    }

    if (this.from) {
      const from = DateTime.fromISO(this.from)
      const to = this.to ? DateTime.fromISO(this.to) : DateTime.now()
      if (!from.isValid || !to.isValid) {
        this.logger.error('Invalid --from/--to date.')
        this.exitCode = 1
        return
      }
      const count = await snapshotRange(from, to)
      this.logger.success(
        `Snapshotted ${count} day(s) from ${from.toISODate()} to ${to.toISODate()}.`
      )
      return
    }

    if (this.backfill && this.backfill > 0) {
      const to = DateTime.now()
      const from = to.minus({ days: this.backfill - 1 })
      const count = await snapshotRange(from, to)
      this.logger.success(`Backfilled ${count} day(s) ending ${to.toISODate()}.`)
      return
    }

    const ok = await writeDailySnapshot(DateTime.now())
    if (ok) this.logger.success(`Snapshotted today (${DateTime.now().toISODate()}).`)
    else this.logger.warning('Nothing written (InfluxDB unavailable).')
  }
}
