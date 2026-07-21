import { type ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import DashboardLayout from '@/layouts/dashboard-layout'
import { ClipboardList } from 'lucide-react'

type StockTakeRow = {
  id: number
  number: string
  status: string
  createdAt: string | null
  completedAt: string | null
  countedLines: number
  totalLines: number
}

type PageProps = {
  stockTakes: StockTakeRow[]
}

function statusVariant(status: string): 'outline' | 'default' | 'secondary' | 'destructive' {
  if (status === 'completed') return 'default'
  if (status === 'cancelled') return 'destructive'
  return 'outline'
}

function fmt(dt: string | null) {
  return dt ? dt.slice(0, 19).replace('T', ' ') : '—'
}

function NewStockTakeDialog() {
  const [open, setOpen] = useState(false)
  const { post, processing } = useForm()

  return (
    <>
      <Button onClick={() => setOpen(true)}>New stock take</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Start a new stock take?"
        description="This snapshots every current inventory line (materials, components, products) as a draft to be counted. Existing draft stock takes are unaffected."
        confirmLabel={processing ? 'Creating…' : 'Create'}
        variant="default"
        onConfirm={() => post('/inventory/stock-takes', { preserveScroll: true })}
      />
    </>
  )
}

export default function StockTakesIndex({ stockTakes }: PageProps) {
  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Stock takes</h1>
          <p className="text-sm text-muted-foreground">
            {stockTakes.length} stock take{stockTakes.length === 1 ? '' : 's'}.
          </p>
        </div>
        <NewStockTakeDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All stock takes</CardTitle>
        </CardHeader>
        <CardContent>
          {stockTakes.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No stock takes yet"
              description="Start one to snapshot current inventory and reconcile it against a physical count."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockTakes.map((st) => (
                  <TableRow key={st.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link href={`/inventory/stock-takes/${st.id}`} className="hover:underline">
                        {st.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(st.status)}>{st.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{fmt(st.createdAt)}</TableCell>
                    <TableCell className="tabular-nums">
                      {st.countedLines}/{st.totalLines} counted
                    </TableCell>
                    <TableCell className="font-mono text-xs">{fmt(st.completedAt)}</TableCell>
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

StockTakesIndex.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
