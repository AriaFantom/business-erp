import { type ReactElement } from 'react'
import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import DashboardLayout from '@/layouts/dashboard-layout'
import { ExternalLink, HardHat, Loader2, UserCheck } from 'lucide-react'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'
import { EmptyState } from '@/components/empty-state'

type WorkerStatus = 'idle' | 'working' | 'inactive'

type Row = {
  id: number
  name: string
  phone: string | null
  payType: string
  status: WorkerStatus
  currentJobId: number | null
  hourlyRate: string
  monthlySalary: string
  standardMonthlyHours: number
  effectiveHourlyRate: string
  minutes30d: number
  labourCost30d: string
  paidTotal: string
  joinedAt: string | null
}

type Filters = { q: string; status: string; payType: string }

type Counts = { total: number; idle: number; working: number; inactive: number }

type PageProps = { workers: Row[]; filters: Filters; counts: Counts }

const STATUS_VARIANT: Record<WorkerStatus, 'default' | 'secondary' | 'outline'> = {
  idle: 'outline',
  working: 'default',
  inactive: 'secondary',
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export default function WorkersIndex({ workers, filters, counts }: PageProps) {
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <Head title="Workers" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workers</h1>
          <p className="text-sm text-muted-foreground">
            People on the payroll — their time is costed into the jobs they work.
          </p>
        </div>
        <Link href="/workers/new">
          <Button>New worker</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total workers" value={counts.total} icon={HardHat} />
        <StatCard label="Working" value={counts.working} icon={Loader2} />
        <StatCard label="Idle" value={counts.idle} icon={UserCheck} />
      </div>

      <ListToolbar
        basePath="/workers"
        q={filters.q}
        searchPlaceholder="Search by name or phone…"
        selects={[
          {
            name: 'status',
            value: filters.status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'idle', label: 'Idle' },
              { value: 'working', label: 'Working' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
          {
            name: 'payType',
            value: filters.payType,
            options: [
              { value: 'all', label: 'All pay types' },
              { value: 'hourly', label: 'Hourly' },
              { value: 'monthly', label: 'Monthly' },
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>All workers</CardTitle>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title="No workers yet"
              description="Add the people who work on your jobs so their hours land in job costs."
              action={
                <Link href="/workers/new">
                  <Button>New worker</Button>
                </Link>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Pay type</TableHead>
                  <TableHead className="text-right">Rate / hour</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Time (30d)</TableHead>
                  <TableHead className="text-right">Labour cost (30d)</TableHead>
                  <TableHead className="text-right">Paid to date</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <div className="font-medium">{w.name}</div>
                      {w.phone && (
                        <div className="text-xs text-muted-foreground">{w.phone}</div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{w.payType}</TableCell>
                    <TableCell className="text-right">
                      {w.effectiveHourlyRate}
                      {w.payType === 'monthly' && (
                        <div className="text-xs text-muted-foreground">
                          {w.monthlySalary} / {w.standardMonthlyHours}h
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[w.status]}>{w.status}</Badge>
                      {w.currentJobId && (
                        <Link
                          href={`/jobs/${w.currentJobId}`}
                          className="ml-2 text-xs underline-offset-2 hover:underline"
                        >
                          job #{w.currentJobId}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMinutes(w.minutes30d)}
                    </TableCell>
                    <TableCell className="text-right">{w.labourCost30d}</TableCell>
                    <TableCell className="text-right">{w.paidTotal}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon" aria-label="Open worker">
                        <Link href={`/workers/${w.id}`}>
                          <ExternalLink className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

WorkersIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
