import { type ReactElement, useState } from 'react'
import { router } from '@inertiajs/react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DashboardLayout from '@/layouts/dashboard-layout'
import { DashboardGrid } from '@/components/dashboard/dashboard-grid'
import type { DashboardData } from '@/components/dashboard/widgets'

type PageProps = {
  data: DashboardData
  from: string
  to: string
}

export default function Dashboard({ data, from, to }: PageProps) {
  const [fromDate, setFromDate] = useState(from.slice(0, 10))
  const [toDate, setToDate] = useState(to.slice(0, 10))

  const apply = () => {
    router.get(
      '/dashboard',
      { from: fromDate, to: toDate },
      { preserveState: false, preserveScroll: true }
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Drag any card by its handle to rearrange. Your layout is saved in this browser.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <Button onClick={apply}>Apply</Button>
        </div>
      </div>

      <DashboardGrid data={data} />
    </div>
  )
}

Dashboard.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
