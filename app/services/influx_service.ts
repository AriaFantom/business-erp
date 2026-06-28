import { InfluxDB, type WriteApi, type QueryApi } from '@influxdata/influxdb-client'
import logger from '@adonisjs/core/services/logger'
import influxConfig from '#config/influx'

/**
 * Thin wrapper around the InfluxDB client used by the metrics snapshot Job
 * (writes) and the dashboard/reports (reads). The whole module is a no-op
 * when InfluxDB is disabled or unconfigured: writers/readers receive `null`
 * and callers fall back to empty data, so the app runs without Influx up.
 */
let client: InfluxDB | null = null

export function isInfluxEnabled(): boolean {
  return influxConfig.enabled
}

function getClient(): InfluxDB | null {
  if (!influxConfig.enabled) return null
  if (!client) {
    client = new InfluxDB({ url: influxConfig.url, token: influxConfig.token })
  }
  return client
}

/**
 * A WriteApi scoped to the configured org/bucket at second precision (daily
 * snapshots only need date granularity). Returns null when disabled. The
 * caller owns the lifecycle and must `flush()`/`close()` when done.
 */
export function getWriteApi(): WriteApi | null {
  const c = getClient()
  if (!c) return null
  return c.getWriteApi(influxConfig.org, influxConfig.bucket, 's')
}

export function getQueryApi(): QueryApi | null {
  const c = getClient()
  if (!c) return null
  return c.getQueryApi(influxConfig.org)
}

export function getBucket(): string {
  return influxConfig.bucket
}

/**
 * Run a Flux query and collect all rows. Returns [] (and logs) on any error
 * so a transient Influx outage degrades to empty charts instead of a 500.
 */
export async function queryRows(flux: string): Promise<Record<string, any>[]> {
  const api = getQueryApi()
  if (!api) return []
  try {
    return (await api.collectRows(flux)) as Record<string, any>[]
  } catch (err) {
    logger.error({ err }, 'influx query failed')
    return []
  }
}
