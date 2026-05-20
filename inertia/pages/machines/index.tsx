import { type ReactElement, useState } from 'react'
import { Head, useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { CheckCircle2, CircleSlash, Cpu, Play, Wrench, XCircle } from 'lucide-react'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'

type MachineStatus = 'idle' | 'running' | 'maintenance' | 'offline' | 'retired'

type Row = {
  id: number
  name: string
  model: string | null
  serialNumber: string | null
  status: MachineStatus
  currentJobId: number | null
  purchaseCost: string
  expenseTotal: string
  totalSpent: string
}

type Filters = { q: string; status: string }

type Counts = {
  total: number
  idle: number
  running: number
  maintenance: number
  offline: number
  retired: number
}

type PageProps = { machines: Row[]; filters: Filters; counts: Counts }

const STATUS_VARIANT: Record<MachineStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  idle: 'outline',
  running: 'default',
  maintenance: 'secondary',
  offline: 'secondary',
  retired: 'destructive',
}

function NewMachineDialog() {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    name: '',
    model: '',
    serialNumber: '',
    notes: '',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add machine</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add machine</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post('/machines', {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field
            label="Name"
            value={data.name}
            error={errors.name}
            onChange={(v) => setData('name', v)}
          />
          <Field
            label="Model"
            value={data.model}
            error={errors.model}
            onChange={(v) => setData('model', v)}
          />
          <Field
            label="Serial number"
            value={data.serialNumber}
            error={errors.serialNumber}
            onChange={(v) => setData('serialNumber', v)}
          />
          <div className="flex flex-col gap-1">
            <Label>Notes</Label>
            <Textarea
              value={data.notes}
              onChange={(e) => setData('notes', e.target.value)}
              rows={3}
            />
            {errors.notes && <span className="text-xs text-destructive">{errors.notes}</span>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Add machine'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  value,
  error,
  onChange,
}: {
  label: string
  value: string
  error?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

export default function MachinesIndex({ machines, filters, counts }: PageProps) {
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <Head title="Machines" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Machines</h1>
          <p className="text-sm text-muted-foreground">
            Physical machines used to fulfil production jobs.
          </p>
        </div>
        <NewMachineDialog />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total"
          value={counts.total}
          icon={Cpu}
          href="/machines"
          active={filters.status === 'all' || !filters.status}
        />
        <StatCard
          label="Idle"
          value={counts.idle}
          icon={CheckCircle2}
          href="/machines?status=idle"
          active={filters.status === 'idle'}
        />
        <StatCard
          label="Running"
          value={counts.running}
          icon={Play}
          href="/machines?status=running"
          active={filters.status === 'running'}
        />
        <StatCard
          label="Maintenance"
          value={counts.maintenance}
          icon={Wrench}
          href="/machines?status=maintenance"
          active={filters.status === 'maintenance'}
        />
        <StatCard
          label="Retired"
          value={counts.retired}
          icon={XCircle}
          href="/machines?status=retired"
          active={filters.status === 'retired'}
        />
      </div>

      <ListToolbar
        basePath="/machines"
        q={filters.q}
        searchPlaceholder="Search by name, model, serial…"
        selects={[
          {
            name: 'status',
            value: filters.status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'idle', label: 'Idle' },
              { value: 'running', label: 'Running' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'offline', label: 'Offline' },
              { value: 'retired', label: 'Retired' },
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>All machines</CardTitle>
          <CardDescription>
            One row per physical machine. Jobs lock the machine they run on; a machine can
            only have one active job at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {machines.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CircleSlash className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {filters.q || filters.status !== 'all'
                  ? 'No machines match the current filters.'
                  : 'No machines yet — add one to get started.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current job</TableHead>
                  <TableHead className="text-right">Purchase</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Total spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {machines.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <Link href={`/machines/${m.id}`} className="hover:underline">
                        {m.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.model ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.serialNumber ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[m.status]}>{m.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {m.currentJobId ? (
                        <Link
                          href={`/jobs/${m.currentJobId}`}
                          className="font-mono text-xs hover:underline"
                        >
                          Job #{m.currentJobId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.purchaseCost}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.expenseTotal}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {m.totalSpent}
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

MachinesIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
