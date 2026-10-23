import { InfluxDB, type WriteApi, type QueryApi } from '@influxdata/influxdb-client'
import influxConfig from '#config/influx'

/**
 * Thin wrapper around the InfluxDB client used by the metrics snapshot Job
 * (writes) and the dashboard/reports (reads). Disabled local installations
 * receive `null`; enabled installations must pass the startup readiness gate.
 */
let client: InfluxDB | null = null

export function isInfluxEnabled(): boolean {
  return influxConfig.enabled
}

type InfluxConnection = Pick<typeof influxConfig, 'url' | 'token' | 'org' | 'bucket'>

/** One probe checks process readiness and that our token can see the configured bucket. */
export async function checkInfluxConnection(
  connection: InfluxConnection,
  request: typeof fetch = fetch
): Promise<void> {
  if (!connection.url || !connection.token || !connection.org || !connection.bucket) {
    throw new Error('InfluxDB is enabled but URL, token, organization, or bucket is missing.')
  }
  const base = connection.url.replace(/\/$/, '')
  const ready = await request(`${base}/ready`, { signal: AbortSignal.timeout(5000) })
  if (!ready.ok) throw new Error(`readiness endpoint returned ${ready.status}`)
  const url = new URL(`${base}/api/v2/buckets`)
  url.searchParams.set('org', connection.org)
  url.searchParams.set('name', connection.bucket)
  const buckets = await request(url, {
    headers: { Authorization: `Token ${connection.token}` },
    signal: AbortSignal.timeout(5000),
  })
  if (!buckets.ok) throw new Error(`bucket check returned ${buckets.status}`)
  const result = (await buckets.json()) as { buckets?: { name?: string }[] }
  if (!result.buckets?.some((bucket) => bucket.name === connection.bucket)) {
    throw new Error('configured bucket does not exist or is inaccessible')
  }
}

type InfluxRetryOptions = {
  request?: typeof fetch
  attempts?: number
  delayMs?: number
}

/** Retry the full authenticated probe without resolving container services during app boot. */
export async function waitForInfluxReady(
  connection: InfluxConnection,
  { request = fetch, attempts = 20, delayMs = 3000 }: InfluxRetryOptions = {}
): Promise<void> {
  let failure = 'unknown error'
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await checkInfluxConnection(connection, request)
      return
    } catch (error) {
      failure = error instanceof Error ? error.message : 'unknown error'
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
  throw new Error(`InfluxDB startup check failed: ${failure}`)
}

/** Fail before the HTTP listener starts if enabled Influx is not usable. */
export async function assertInfluxReady(): Promise<void> {
  if (!influxConfig.enabled) return
  if (!influxConfig.url || !influxConfig.token || !influxConfig.org || !influxConfig.bucket) {
    throw new Error('InfluxDB is enabled but URL, token, organization, or bucket is missing.')
  }
  await waitForInfluxReady(influxConfig)
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
    const { default: logger } = await import('@adonisjs/core/services/logger')
    logger.error({ err }, 'influx query failed')
    return []
  }
}
