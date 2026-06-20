import { type ReactElement, useEffect, useRef, useState } from 'react'
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
import { ProductImageGallery } from '@/components/catalog/product-image-gallery'
import { DefaultPriceDialog } from '@/components/catalog/default-price-dialog'

type GalleryImage = {
  id: number
  url: string | null
  originalName: string
  sortOrder: number
  isPrimary: boolean
  createdAt: string | null
}

type FileRow = {
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

type ProfitJobRow = {
  id: number
  number: string
  completedAt: string | null
  producedQty: number
  totalCost: number
  unitCost: number
  sellingPrice: number | null
  profitPerUnit: number | null
  profitPct: number | null
  suggestedPinPrice: number
}

type ProfitAnalysis = {
  sellingPrice: number | null
  costBasis: number | null
  profitPctUsed: number | null
  profitFrom: 'manual' | 'product_default' | 'product' | 'category' | 'global' | null
  taxRatePct: number
  taxFrom: 'product' | 'category' | 'global'
  rounding: 'nearest_50_paise' | 'nearest_rupee' | 'none'
  profitPerUnit: number | null
  profitPct: number | null
  defaultSalePrice: number | null
  defaultSalePriceSource: {
    jobId: number | null
    jobNumber: string | null
    setAt: string | null
    setByUserName: string | null
  } | null
  autoComputedPrice: number | null
  jobs: ProfitJobRow[]
}

type PageProps = {
  product: Product
  images: GalleryImage[]
  files: FileRow[]
  profitAnalysis: ProfitAnalysis
}

const ACCEPTED_MODEL_TYPES = '.stl,.3mf,.obj,.step,.stp,.igs,.iges,.ply,.gcode,.zip'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatMoney(n: number | null) {
  if (n === null || !Number.isFinite(n)) return '—'
  return `₹${n.toFixed(2)}`
}

function formatPct(n: number | null) {
  if (n === null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(2)}%`
}

const ROUNDING_LABEL: Record<ProfitAnalysis['rounding'], string> = {
  nearest_50_paise: 'nearest ₹0.50',
  nearest_rupee: 'nearest ₹1',
  none: 'no rounding',
}

function ProfitAnalysisCard({
  analysis,
  canEdit,
  onSetDefault,
}: {
  analysis: ProfitAnalysis
  canEdit: boolean
  onSetDefault: (job: ProfitJobRow | null) => void
}) {
  const {
    sellingPrice,
    costBasis,
    profitPerUnit,
    profitPct,
    profitPctUsed,
    profitFrom,
    taxRatePct,
    taxFrom,
    rounding,
    jobs,
  } = analysis

  const profitToneClass =
    profitPerUnit === null
      ? 'text-muted-foreground'
      : profitPerUnit >= 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profit analysis</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Avg unit cost
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(costBasis)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Weighted across last 5 completed jobs
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Suggested selling price
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(sellingPrice)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {profitPctUsed !== null
                ? `Profit ${formatPct(profitPctUsed)} (${profitFrom ?? '—'})`
                : profitFrom === 'manual'
                  ? 'Manual override'
                  : 'No basis yet'}
            </div>
          </div>
          <div className={`rounded-lg border bg-muted/30 p-4 ${profitToneClass}`}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Profit / unit
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(profitPerUnit)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {profitPct !== null ? `${formatPct(profitPct)} margin on cost` : '—'}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Each row's selling price = that job's unit cost × (1 + profit %) using profit{' '}
          {formatPct(profitPctUsed)} ({profitFrom ?? '—'}); tax {formatPct(taxRatePct)} ({taxFrom});
          rounded to {ROUNDING_LABEL[rounding]}. Profit % stays constant; selling price moves with
          batch cost.
        </p>

        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Complete a production job to see profit analysis.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Produced</TableHead>
                <TableHead className="text-right">Total cost</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Selling price</TableHead>
                <TableHead className="text-right">Profit / unit</TableHead>
                <TableHead className="text-right">Profit %</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j, idx) => {
                const rowTone =
                  j.profitPerUnit === null
                    ? ''
                    : j.profitPerUnit >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                return (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        {j.number}
                        {idx === 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            latest
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {j.completedAt?.slice(0, 10) ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{j.producedQty}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(j.totalCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(j.unitCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(j.sellingPrice)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${rowTone}`}>
                      {formatMoney(j.profitPerUnit)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${rowTone}`}>
                      {formatPct(j.profitPct)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onSetDefault(j)}>
                          Set as default
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function ProductHero({ product }: { product: Product }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <AvatarUploader
            uploadPath={`/catalog/products/${product.id}/image`}
            imageUrl={product.imageUrl}
            alt={product.name}
            size={224}
          />
          <p className="text-center text-xs text-muted-foreground">
            {product.imageUrl ? 'Click image to replace' : 'Click to upload image'}
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{product.name}</h1>
              <p className="font-mono text-sm text-muted-foreground">{product.sku}</p>
            </div>
            {product.isActive ? (
              <Badge variant="outline">Active</Badge>
            ) : (
              <Badge variant="secondary">Archived</Badge>
            )}
            {product.category?.name === 'Custom Orders' && <Badge variant="secondary">Custom</Badge>}
          </div>
          {product.description && <p className="text-sm">{product.description}</p>}
          <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-3">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="sm:col-span-2">{product.category?.name ?? '—'}</dd>
            <dt className="text-muted-foreground">Default profit %</dt>
            <dd className="sm:col-span-2">{product.defaultProfitPct ?? '—'}</dd>
            <dt className="text-muted-foreground">Tax %</dt>
            <dd className="sm:col-span-2">{product.taxRatePct ?? '—'}</dd>
            <dt className="text-muted-foreground">In production</dt>
            <dd className="sm:col-span-2 tabular-nums">{product.inProductionQty}</dd>
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

function FilesCard({ productId, initial }: { productId: number; initial: FileRow[] }) {
  const [fileList, setFileList] = useState<FileRow[]>(initial)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<FileRow | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFileList(initial)
  }, [initial])

  async function refresh() {
    try {
      const res = await fetch(`/catalog/products/${productId}/files`, {
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const json = await res.json()
        setFileList(json.data ?? [])
      }
    } catch {
      toast.error('Could not refresh files.')
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const MAX_MB = 50
    if (file.size > MAX_MB * 1024 * 1024) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1)
      toast.error(`File is ${sizeMb} MB — max allowed is ${MAX_MB} MB.`)
      return
    }

    setBusy(true)
    router.post(
      `/catalog/products/${productId}/files`,
      { file },
      {
        forceFormData: true,
        preserveScroll: true,
        onError: (errors) => {
          const msg =
            (typeof errors === 'object' && errors && (errors.file || Object.values(errors)[0])) ||
            'File upload failed.'
          toast.error(String(msg))
        },
        onFinish: () => {
          setBusy(false)
          refresh()
        },
      }
    )
  }

  function deleteFile(file: FileRow) {
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
            ref={fileInputRef}
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
          stl, 3mf, obj, step, stp, igs, iges, ply, gcode, zip — up to 50 MB each.
        </p>
        {fileList.length === 0 ? (
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
              {fileList.map((f) => (
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
                        <a href={`/catalog/products/${productId}/files/${f.id}/download`}>
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
        onConfirm={() => {
          if (pending) deleteFile(pending)
        }}
      />
    </Card>
  )
}

export default function ProductShowPage({ product, images, files, profitAnalysis }: PageProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogJob, setDialogJob] = useState<ProfitJobRow | null>(null)
  const canEdit = true // TODO: derive from permissions prop when available

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

      <ProfitAnalysisCard
        analysis={profitAnalysis}
        canEdit={canEdit}
        onSetDefault={(job) => {
          setDialogJob(job)
          setDialogOpen(true)
        }}
      />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Default sale price</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profitAnalysis.defaultSalePrice !== null ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold">
                  ₹{profitAnalysis.defaultSalePrice.toLocaleString()}
                </div>
                {profitAnalysis.defaultSalePriceSource && (
                  <div className="text-xs text-muted-foreground">
                    {profitAnalysis.defaultSalePriceSource.jobNumber
                      ? `From #${profitAnalysis.defaultSalePriceSource.jobNumber}`
                      : 'Set manually'}
                    {profitAnalysis.defaultSalePriceSource.setByUserName
                      ? ` · by ${profitAnalysis.defaultSalePriceSource.setByUserName}`
                      : ''}
                  </div>
                )}
                {profitAnalysis.autoComputedPrice !== null && (
                  <div className="text-xs text-muted-foreground">
                    Auto-calculated: ₹{profitAnalysis.autoComputedPrice.toLocaleString()}
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDialogJob(null)
                      setDialogOpen(true)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm('Clear the default sale price?')) return
                      router.post(
                        `/catalog/products/${product.id}/default-price/delete`,
                        {},
                        { preserveScroll: true }
                      )
                    }}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                No default set — sales surfaces use the auto-calculated price
                {profitAnalysis.autoComputedPrice !== null
                  ? ` (₹${profitAnalysis.autoComputedPrice.toLocaleString()})`
                  : ''}
                .
              </div>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDialogJob(null)
                    setDialogOpen(true)
                  }}
                >
                  Set default
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <DefaultPriceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productId={product.id}
        initialPrice={dialogJob ? null : profitAnalysis.defaultSalePrice}
        suggestedPrice={dialogJob?.suggestedPinPrice ?? null}
        autoComputedPrice={profitAnalysis.autoComputedPrice}
        sourceJob={dialogJob ? { id: dialogJob.id, number: dialogJob.number } : null}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductImageGallery productId={product.id} images={images} canEdit={canEdit} />
          </CardContent>
        </Card>
        <FilesCard productId={product.id} initial={files} />
        <QrCard product={product} />
      </div>
    </div>
  )
}

ProductShowPage.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
