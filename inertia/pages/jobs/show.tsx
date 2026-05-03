import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type Job = {
  id: number
  number: string
  status: string
  productId: number
  productName: string
  plannedQty: number
  producedQty: number
  parentJobId: number | null
  startedAt: string | null
  completedAt: string | null
  totalMaterialCost: string
  totalComponentCost: string
  totalExpense: string
  totalCost: string
  unitCost: string
  chainCost: string
  note: string | null
}

type Consumption = {
  id: number
  itemKind: string
  itemId: number
  itemName: string
  itemSku: string
  qtyConsumed: string
  qtyWasted: string
  unitCostAtConsume: string
  lineCost: string
  reason: string
  createdAt: string | null
}

type Expense = {
  id: number
  kind: string
  description: string
  amount: string
  incurredAt: string
}

type InventoryItem = {
  itemKind: 'material' | 'component'
  itemId: number
  sku: string
  name: string
  unit: string
  onHand: string
}

type PageProps = {
  job: Job
  consumptions: Consumption[]
  expenses: Expense[]
  inventoryItems: InventoryItem[]
}

function PostAction({
  path,
  label,
  variant = 'default',
  confirmText,
}: {
  path: string
  label: string
  variant?: 'default' | 'destructive' | 'outline'
  confirmText?: string
}) {
  const { post, processing } = useForm()
  return (
    <Button
      variant={variant}
      disabled={processing}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return
        post(path, { preserveScroll: true })
      }}
    >
      {label}
    </Button>
  )
}

function ConsumeDialog({ jobId, items }: { jobId: number; items: InventoryItem[] }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('')
  const { data, setData, post, processing, errors, reset } = useForm({
    itemKind: '',
    itemId: 0,
    qtyConsumed: 0,
    qtyWasted: 0,
    reason: 'consume',
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Consume material</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Consume material</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/jobs/${jobId}/consumptions`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setTarget('')
                setOpen(false)
              },
            })
          }}
        >
          <Field label="Item" error={errors.itemKind ?? errors.itemId}>
            <Select
              value={target}
              onValueChange={(v) => {
                setTarget(v)
                const [kind, id] = v.split(':')
                setData('itemKind', kind)
                setData('itemId', Number(id))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((it) => (
                  <SelectItem
                    key={`${it.itemKind}:${it.itemId}`}
                    value={`${it.itemKind}:${it.itemId}`}
                  >
                    [{it.itemKind}] {it.name} — on hand {it.onHand} {it.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Qty consumed" error={errors.qtyConsumed}>
            <Input
              type="number"
              step="0.001"
              value={data.qtyConsumed}
              onChange={(e) => setData('qtyConsumed', Number(e.target.value))}
            />
          </Field>
          <Field label="Of which wasted" error={errors.qtyWasted}>
            <Input
              type="number"
              step="0.001"
              value={data.qtyWasted}
              onChange={(e) => setData('qtyWasted', Number(e.target.value))}
            />
          </Field>
          <Field label="Reason" error={errors.reason}>
            <Select value={data.reason} onValueChange={(v) => setData('reason', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consume">consume</SelectItem>
                <SelectItem value="reprint">reprint</SelectItem>
                <SelectItem value="waste">waste</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={processing || !target}>
              {processing ? 'Saving…' : 'Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ExpenseDialog({ jobId }: { jobId: number }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    kind: 'electricity',
    description: '',
    amount: 0,
    incurredAt: new Date().toISOString().slice(0, 10),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Add expense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/jobs/${jobId}/expenses`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field label="Kind" error={errors.kind}>
            <Select value={data.kind} onValueChange={(v) => setData('kind', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="electricity">electricity</SelectItem>
                <SelectItem value="labor">labor</SelectItem>
                <SelectItem value="overhead">overhead</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description" error={errors.description}>
            <Input
              value={data.description}
              onChange={(e) => setData('description', e.target.value)}
            />
          </Field>
          <Field label="Amount" error={errors.amount}>
            <Input
              type="number"
              step="0.01"
              value={data.amount}
              onChange={(e) => setData('amount', Number(e.target.value))}
            />
          </Field>
          <Field label="Incurred on" error={errors.incurredAt}>
            <Input
              type="date"
              value={data.incurredAt}
              onChange={(e) => setData('incurredAt', e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CompleteDialog({ jobId }: { jobId: number }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    producedQty: 1,
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Complete</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete job</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/jobs/${jobId}/complete`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field label="Produced qty" error={errors.producedQty}>
            <Input
              type="number"
              value={data.producedQty}
              onChange={(e) => setData('producedQty', Number(e.target.value))}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {processing ? 'Saving…' : 'Complete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FailDialog({ jobId }: { jobId: number }) {
  const [open, setOpen] = useState(false)
  const { data, setData, post, processing, errors, reset } = useForm({
    reason: '',
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Fail</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark job as failed</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            post(`/jobs/${jobId}/fail`, {
              preserveScroll: true,
              onSuccess: () => {
                reset()
                setOpen(false)
              },
            })
          }}
        >
          <Field label="Reason" error={errors.reason}>
            <Input
              value={data.reason}
              onChange={(e) => setData('reason', e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={processing}>
              {processing ? 'Saving…' : 'Mark failed'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

export default function JobShow({
  job,
  consumptions,
  expenses,
  inventoryItems,
}: PageProps) {
  const isActive = job.status === 'draft' || job.status === 'in_progress'

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Job {job.number}</h1>
          <p className="text-sm text-muted-foreground">
            {job.productName} · planned {job.plannedQty} · produced {job.producedQty}
            {job.parentJobId ? ` · reprint of #${job.parentJobId}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{job.status}</Badge>
          {job.status === 'draft' && (
            <PostAction
              path={`/jobs/${job.id}/start`}
              label="Start"
              confirmText="Start this job?"
            />
          )}
          {isActive && (
            <>
              <ConsumeDialog jobId={job.id} items={inventoryItems} />
              <ExpenseDialog jobId={job.id} />
            </>
          )}
          {job.status === 'in_progress' && (
            <>
              <CompleteDialog jobId={job.id} />
              <FailDialog jobId={job.id} />
            </>
          )}
          {job.status === 'draft' && (
            <PostAction
              path={`/jobs/${job.id}/cancel`}
              label="Cancel"
              variant="destructive"
              confirmText="Cancel this job?"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Material cost</dt>
              <dd className="text-right">{job.totalMaterialCost}</dd>
              <dt className="text-muted-foreground">Component cost</dt>
              <dd className="text-right">{job.totalComponentCost}</dd>
              <dt className="text-muted-foreground">Expenses</dt>
              <dd className="text-right">{job.totalExpense}</dd>
              <dt className="font-medium">Total</dt>
              <dd className="text-right font-medium">{job.totalCost}</dd>
              <dt className="text-muted-foreground">Unit cost</dt>
              <dd className="text-right">{job.unitCost}</dd>
              <dt className="text-muted-foreground">Reprint chain cost</dt>
              <dd className="text-right">{job.chainCost}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Started</dt>
              <dd className="text-right font-mono text-xs">
                {job.startedAt?.slice(0, 19).replace('T', ' ') ?? '—'}
              </dd>
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="text-right font-mono text-xs">
                {job.completedAt?.slice(0, 19).replace('T', ' ') ?? '—'}
              </dd>
            </dl>
            {job.note && (
              <p className="mt-3 text-sm text-muted-foreground">{job.note}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumptions</CardTitle>
        </CardHeader>
        <CardContent>
          {consumptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing consumed yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Wasted</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Line cost</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consumptions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">
                      {c.createdAt?.slice(0, 19).replace('T', ' ') ?? '—'}
                    </TableCell>
                    <TableCell>{c.itemKind}</TableCell>
                    <TableCell>{c.itemName}</TableCell>
                    <TableCell className="text-right">{c.qtyConsumed}</TableCell>
                    <TableCell className="text-right">{c.qtyWasted}</TableCell>
                    <TableCell className="text-right">{c.unitCostAtConsume}</TableCell>
                    <TableCell className="text-right">{c.lineCost}</TableCell>
                    <TableCell>{c.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses logged.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.incurredAt.slice(0, 10)}</TableCell>
                    <TableCell>{e.kind}</TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-right">{e.amount}</TableCell>
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

JobShow.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
