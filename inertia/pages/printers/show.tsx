import { Head, router, useForm, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PrinterDetail {
  id: number
  name: string
  model: string | null
  serialNumber: string | null
  status: string
  currentJobId: number | null
  notes: string | null
  acquiredAt: string | null
  purchaseCost: string
  expenseTotal: string
  totalSpent: string
}
interface JobRow {
  id: number
  number: string
  status: string
  startedAt: string | null
  completedAt: string | null
  totalCost: string
}
interface ExpenseRow {
  id: number
  kind: string
  description: string
  amount: string
  incurredAt: string
}

export default function PrinterShow() {
  const { props } = usePage<{ printer: PrinterDetail; jobs: JobRow[]; expenses: ExpenseRow[] }>()
  const { printer, jobs, expenses } = props
  const form = useForm({ kind: 'maintenance', description: '', amount: 0 })

  return (
    <>
      <Head title={printer.name} />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{printer.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge>{printer.status}</Badge>
            <span>{printer.model ?? '—'}</span>
            <span>SN: {printer.serialNumber ?? '—'}</span>
            <span>Total spent: {printer.totalSpent}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {printer.status !== 'retired' ? (
            <Button
              variant="outline"
              onClick={() => router.post(`/printers/${printer.id}/maintenance`)}
            >
              {printer.status === 'maintenance' ? 'End maintenance' : 'Start maintenance'}
            </Button>
          ) : null}
          {printer.status !== 'retired' ? (
            <Button
              variant="destructive"
              onClick={() => router.post(`/printers/${printer.id}/retire`)}
            >
              Retire
            </Button>
          ) : null}
        </div>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-medium">Job history</h2>
        <div className="rounded border">
          <table className="w-full">
            <thead className="border-b text-left text-sm text-muted-foreground">
              <tr>
                <th className="p-3">Number</th>
                <th className="p-3">Status</th>
                <th className="p-3">Started</th>
                <th className="p-3">Completed</th>
                <th className="p-3 text-right">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b last:border-0">
                  <td className="p-3">
                    <Link href={`/jobs/${j.id}`} className="hover:underline">
                      {j.number}
                    </Link>
                  </td>
                  <td className="p-3">{j.status}</td>
                  <td className="p-3 text-muted-foreground">{j.startedAt ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{j.completedAt ?? '—'}</td>
                  <td className="p-3 text-right font-mono">{j.totalCost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Expenses</h2>
        <form
          className="mb-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            form.post(`/printers/${printer.id}/expense`)
          }}
        >
          <div className="w-40">
            <Label>Kind</Label>
            <Select value={form.data.kind} onValueChange={(v) => form.setData('kind', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="parts">Parts</SelectItem>
                <SelectItem value="addon">Add-on</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>Description</Label>
            <Input
              value={form.data.description}
              onChange={(e) => form.setData('description', e.target.value)}
              required
            />
          </div>
          <div className="w-32">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              min={0.01}
              value={form.data.amount}
              onChange={(e) => form.setData('amount', Number(e.target.value))}
              required
            />
          </div>
          <Button type="submit" disabled={form.processing}>
            Add
          </Button>
        </form>
        <div className="rounded border">
          <table className="w-full">
            <thead className="border-b text-left text-sm text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Kind</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-3 text-muted-foreground">{e.incurredAt}</td>
                  <td className="p-3">{e.kind}</td>
                  <td className="p-3">{e.description}</td>
                  <td className="p-3 text-right font-mono">{e.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
