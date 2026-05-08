import { type ReactElement, useEffect, useState } from 'react'
import { router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft, Download, Paperclip, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
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
import DashboardLayout from '@/layouts/dashboard-layout'
import { AvatarUploader } from '@/components/catalog/avatar-uploader'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Attachment = {
  id: number
  originalName: string
  sizeBytes: number
  mimeType: string | null
  createdAt: string | null
}

type Product = {
  id: number
  sku: string
  name: string
  description: string | null
  category: { id: number; name: string } | null
  defaultProfitPct: string | null
  taxRatePct: string | null
  imageUrl: string | null
  isActive: boolean
  inProductionQty: number
  soldQty: number
  createdAt: string | null
  updatedAt: string | null
}

type PageProps = { product: Product; attachments: Attachment[] }

const ACCEPTED_MODEL_TYPES =
  '.stl,.3mf,.obj,.step,.stp,.igs,.iges,.ply,.gcode,.zip'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function ProductHero({ product }: { product: Product }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6 sm:flex-row">
        <div className="flex flex-col items-center gap-3">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-56 w-56 rounded-lg border bg-muted object-cover"
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
              No image
            </div>
          )}
          <AvatarUploader
            uploadPath={`/catalog/products/${product.id}/image`}
            imageUrl={product.imageUrl}
            alt={product.name}
            size={36}
          />
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{product.name}</h1>
              <p className="font-mono text-sm text-muted-foreground">
                {product.sku}
              </p>
            </div>
            {product.isActive ? (
              <Badge variant="outline">Active</Badge>
            ) : (
              <Badge variant="secondary">Archived</Badge>
            )}
          </div>
          {product.description && (
            <p className="text-sm">{product.description}</p>
          )}
          <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-3">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="sm:col-span-2">{product.category?.name ?? '—'}</dd>
            <dt className="text-muted-foreground">Default profit %</dt>
            <dd className="sm:col-span-2">{product.defaultProfitPct ?? '—'}</dd>
            <dt className="text-muted-foreground">Tax %</dt>
            <dd className="sm:col-span-2">{product.taxRatePct ?? '—'}</dd>
            <dt className="text-muted-foreground">In production</dt>
            <dd className="sm:col-span-2 tabular-nums">
              {product.inProductionQty}
            </dd>
            <dt className="text-muted-foreground">Sold (confirmed)</dt>
            <dd className="sm:col-span-2 tabular-nums">{product.soldQty}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="sm:col-span-2 font-mono text-xs">
              {product.createdAt?.slice(0, 10) ?? '—'}
            </dd>
          </dl>
        </div>
      </CardContent>
    </Card>
  )
}

function QrCard({ product }: { product: Product }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>QR code</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 pb-6">
        <img
          src={`/catalog/products/${product.id}/qr`}
          alt={`QR code for ${product.name}`}
          className="h-56 w-56 rounded border bg-white object-contain p-3"
        />
        <p className="text-center text-xs text-muted-foreground">
          Scan to open this product detail page.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={`/catalog/products/${product.id}/qr/download`}>
            <Download className="size-4" />
            Download PNG
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

function FilesCard({
  productId,
  initial,
}: {
  productId: number
  initial: Attachment[]
}) {
  const [files, setFiles] = useState<Attachment[]>(initial)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Attachment | null>(null)

  useEffect(() => {
    setFiles(initial)
  }, [initial])

  async function refresh() {
    try {
      const res = await fetch(`/catalog/products/${productId}/files`, {
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const json = await res.json()
        setFiles(json.data ?? [])
      }
    } catch {
      toast.error('Could not refresh files.')
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    router.post(
      `/catalog/products/${productId}/files`,
      { file },
      {
        forceFormData: true,
        preserveScroll: true,
        onFinish: () => {
          setBusy(false)
          refresh()
        },
      }
    )
  }

  function deleteFile(file: Attachment) {
    setBusy(true)
    router.post(
      `/catalog/products/${productId}/files/${file.id}/delete`,
      {},
      {
        preserveScroll: true,
        onFinish: () => {
          setBusy(false)
          refresh()
          setPending(null)
        },
      }
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>3D model files</CardTitle>
        <label className="cursor-pointer">
          <input
            type="file"
            accept={ACCEPTED_MODEL_TYPES}
            className="hidden"
            disabled={busy}
            onChange={onFileChange}
          />
          <Button asChild size="sm" disabled={busy}>
            <span>
              <Upload className="size-4" />
              {busy ? 'Working…' : 'Upload'}
            </span>
          </Button>
        </label>
      </CardHeader>
      <CardContent>
        <p className="pb-2 text-xs text-muted-foreground">
          stl, 3mf, obj, step, stp, igs, iges, ply, gcode, zip — up to 50 MB
          each.
        </p>
        {files.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
            <Paperclip className="size-6" />
            No files attached yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="break-all">{f.originalName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSize(f.sizeBytes)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {f.createdAt?.slice(0, 10) ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" aria-label="Download">
                        <a
                          href={`/catalog/products/${productId}/files/${f.id}/download`}
                        >
                          <Download className="size-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete"
                        disabled={busy}
                        onClick={() => setPending(f)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending ? `Remove "${pending.originalName}"?` : ''}
        description="The file will be deleted from object storage. This cannot be undone."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => pending && deleteFile(pending)}
      />
    </Card>
  )
}

export default function ProductShowPage({ product, attachments }: PageProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/catalog/products">
            <ArrowLeft className="size-4" />
            Back to products
          </Link>
        </Button>
      </div>

      <ProductHero product={product} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <FilesCard productId={product.id} initial={attachments} />
        <QrCard product={product} />
      </div>
    </div>
  )
}

ProductShowPage.layout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
)
