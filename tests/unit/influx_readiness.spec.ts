import { test } from '@japa/runner'
import { checkInfluxConnection, waitForInfluxReady } from '#services/influx_service'

const connection = {
  url: 'http://influxdb.railway.internal:8086',
  token: 'test-token',
  org: 'business-erp',
  bucket: 'dashboard-metrics',
}

test.group('InfluxDB startup check', () => {
  test('requires complete configuration', async ({ assert }) => {
    await assert.rejects(
      () => checkInfluxConnection({ ...connection, token: '' }),
      /token, organization, or bucket is missing/
    )
  })

  test('checks readiness, token authorization and bucket presence', async ({ assert }) => {
    const seen: string[] = []
    const request = (async (url: string | URL, options?: RequestInit) => {
      seen.push(String(url))
      if (String(url).endsWith('/ready')) return new Response(null, { status: 200 })
      assert.equal((options?.headers as Record<string, string>).Authorization, 'Token test-token')
      return Response.json({ buckets: [{ name: 'dashboard-metrics' }] })
    }) as typeof fetch
    await checkInfluxConnection(connection, request)
    assert.lengthOf(seen, 2)
    assert.include(seen[1], 'name=dashboard-metrics')
  })

  test('successful startup retry returns without using application container services', async ({
    assert,
  }) => {
    let requests = 0
    const request = (async (url: string | URL) => {
      requests++
      return String(url).endsWith('/ready')
        ? new Response(null, { status: 200 })
        : Response.json({ buckets: [{ name: 'dashboard-metrics' }] })
    }) as typeof fetch

    await waitForInfluxReady(connection, { request, attempts: 1, delayMs: 0 })
    assert.equal(requests, 2)
  })

  test('rejects an inaccessible configured bucket', async ({ assert }) => {
    const request = (async (url: string | URL) =>
      String(url).endsWith('/ready')
        ? new Response(null, { status: 200 })
        : Response.json({ buckets: [] })) as typeof fetch
    await assert.rejects(
      () => checkInfluxConnection(connection, request),
      /bucket does not exist or is inaccessible/
    )
  })
})
