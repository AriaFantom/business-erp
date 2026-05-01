import type { ReactElement } from 'react'

import DashboardLayout from '@/layouts/dashboard-layout'

export default function Dashboard() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Pick something from the sidebar to get started.
        </p>
      </div>
    </div>
  )
}

Dashboard.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
