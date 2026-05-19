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
import { CheckCircle2, CircleSlash, Printer as PrinterIcon, Wrench, XCircle } from 'lucide-react'
import { ListToolbar } from '@/components/catalog/list-toolbar'
import { StatCard } from '@/components/catalog/stat-card'

type PrinterStatus = 'idle' | 'printing' | 'maintenance' | 'offline' | 'retired'

type Row = {
  id: number
  name: string
  model: string | null
  serialNumber: string | null
  status: PrinterStatus
  currentJobId: number | null
  purchaseCost: string
  expenseTotal: string
  totalSpent: string
}

type Filters = { q: string; status: string }

type Counts = {
  total: number
  idle: number
  printing: number
  maintenance: number
  offline: number
  retired: number
}

type PageProps = { printers: Row[]; filters: Filters; counts: Counts }

const STATUS_VARIANT: Record<PrinterStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  idle: 'outline',
  printing: 'default',
  maintenance: 'secondary',
  offline: 'secondary',
  retired: 'destructive',
}

function NewPrinterDialog() {
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
        <Button>Add printer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add printer</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post('/printers', {
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
              {processing ? 'Saving…' : 'Add printer'}
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

export default function PrintersIndex({ printers, filters, counts }: PageProps) {
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <Head title="Printers" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Printers</h1>
          <p className="text-sm text-muted-foreground">
            Physical 3D printers used to fulfil production jobs.
          </p>
        </div>
        <NewPrinterDialog />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total"
          value={counts.total}
          icon={PrinterIcon}
          href="/printers"
          active={filters.status === 'all' || !filters.status}
        />
        <StatCard
          label="Idle"
          value={counts.idle}
          icon={CheckCircle2}
          href="/printers?status=idle"
          active={filters.status === 'idle'}
        />
        <StatCard
          label="Printing"
          value={counts.printing}
          icon={PrinterIcon}
          href="/printers?status=printing"
          active={filters.status === 'printing'}
        />
        <StatCard
          label="Maintenance"
          value={counts.maintenance}
          icon={Wrench}
          href="/printers?status=maintenance"
          active={filters.status === 'maintenance'}
        />
        <StatCard
          label="Retired"
          value={counts.retired}
          icon={XCircle}
          href="/printers?status=retired"
          active={filters.status === 'retired'}
        />
      </div>

      <ListToolbar
        basePath="/printers"
        q={filters.q}
        searchPlaceholder="Search by name, model, serial…"
        selects={[
          {
            name: 'status',
            value: filters.status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'idle', label: 'Idle' },
              { value: 'printing', label: 'Printing' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'offline', label: 'Offline' },
              { value: 'retired', label: 'Retired' },
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>All printers</CardTitle>
          <CardDescription>
            One row per physical machine. Jobs lock the printer they run on; a printer can
            only have one active job at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {printers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CircleSlash className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {filters.q || filters.status !== 'all'
                  ? 'No printers match the current filters.'
                  : 'No printers yet — add one to get started.'}
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
                {printers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link href={`/printers/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.model ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.serialNumber ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.currentJobId ? (
                        <Link
                          href={`/jobs/${p.currentJobId}`}
                          className="font-mono text-xs hover:underline"
                        >
                          Job #{p.currentJobId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.purchaseCost}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.expenseTotal}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {p.totalSpent}
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

PrintersIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
