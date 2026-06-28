import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Machine from '#models/machine'
import { queryDashboardSeries } from '#services/metrics_service'

function parseRange(qs: Record<string, unknown>): { from: DateTime; to: DateTime } {
  const from = qs.from
    ? DateTime.fromISO(String(qs.from))
    : DateTime.now().minus({ months: 12 }).startOf('day')
  const to = qs.to ? DateTime.fromISO(String(qs.to)) : DateTime.now().endOf('day')
  return { from, to }
}

const MACHINE_STATUSES = ['idle', 'running', 'maintenance', 'offline', 'retired'] as const

export default class DashboardController {
  /**
   * GET /dashboard — analytics board.
   *
   * Trend/aggregate widgets read from InfluxDB (populated by the daily
   * `metrics:snapshot` Job) for the selected window. Active machines and the
   * machine-status donut are computed live from Postgres because they reflect
   * real-time state, not a daily rollup.
   */
  async index({ request, inertia }: HttpContext) {
    const { from, to } = parseRange(request.qs())

    const [series, machines] = await Promise.all([
      queryDashboardSeries(from, to),
      Machine.query().preload('currentJob', (q) => q.preload('product').preload('currentStage')),
    ])

    const activeMachines = machines
      .filter((m) => m.status === 'running')
      .map((m) => ({
        id: m.id,
        name: m.name,
        jobNumber: m.currentJob?.number ?? null,
        productName: m.currentJob?.product?.name ?? null,
        stage: m.currentJob?.currentStage?.name ?? null,
      }))

    const machineStatusCounts = MACHINE_STATUSES.map((status) => ({
      status,
      count: machines.filter((m) => m.status === status).length,
    })).filter((s) => s.count > 0)

    return inertia.render('dashboard', {
      data: { ...series, activeMachines, machineStatusCounts },
      from: from.toISO() ?? '',
      to: to.toISO() ?? '',
    })
  }
}
