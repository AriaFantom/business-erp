import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { buildInventoryReport, buildJobsReport, buildProfitReport } from '#services/reports_service'

function parseRange(qs: Record<string, unknown>): { from: DateTime; to: DateTime } {
  const from = qs.from
    ? DateTime.fromISO(String(qs.from))
    : DateTime.now().minus({ months: 1 }).startOf('day')
  const to = qs.to ? DateTime.fromISO(String(qs.to)) : DateTime.now().endOf('day')
  return { from, to }
}

export default class ReportsController {
  async profit({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('reports.view' as never)
    const { from, to } = parseRange(request.qs())
    const data = await buildProfitReport(from, to)
    return inertia.render('reports/profit', { report: data })
  }

  async inventory({ inertia, bouncer }: HttpContext) {
    await bouncer.authorize('reports.view' as never)
    const data = await buildInventoryReport()
    return inertia.render('reports/inventory', { report: data })
  }

  async jobs({ request, inertia, bouncer }: HttpContext) {
    await bouncer.authorize('reports.view' as never)
    const { from, to } = parseRange(request.qs())
    const rows = await buildJobsReport(from, to)
    return inertia.render('reports/jobs', {
      rows,
      from: from.toISO() ?? '',
      to: to.toISO() ?? '',
    })
  }
}
