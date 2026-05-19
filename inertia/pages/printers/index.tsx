import { Head, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PrinterRow {
  id: number
  name: string
  model: string | null
  status: 'idle' | 'printing' | 'maintenance' | 'offline' | 'retired'
  currentJobId: number | null
  totalSpent: string
}

export default function PrintersIndex() {
  const { props } = usePage<{ printers: PrinterRow[] }>()
  return (
    <>
      <Head title="Printers" />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Printers</h1>
        <Link href="/printers/new">
          <Button>Add printer</Button>
        </Link>
      </div>
      <div className="rounded border">
        <table className="w-full">
          <thead className="border-b text-left text-sm text-muted-foreground">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Model</th>
              <th className="p-3">Status</th>
              <th className="p-3">Current job</th>
              <th className="p-3 text-right">Total spent</th>
            </tr>
          </thead>
          <tbody>
            {props.printers.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-3">
                  <Link href={`/printers/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{p.model ?? '—'}</td>
                <td className="p-3">
                  <Badge variant={p.status === 'idle' ? 'default' : 'secondary'}>{p.status}</Badge>
                </td>
                <td className="p-3">
                  {p.currentJobId ? (
                    <Link href={`/jobs/${p.currentJobId}`} className="hover:underline">
                      Job #{p.currentJobId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-right font-mono">{p.totalSpent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
