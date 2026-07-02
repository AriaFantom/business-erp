import { useEffect, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Paperclip, Upload, Download, Trash2 } from 'lucide-react'

type Attachment = {
  id: number
  originalName: string
  sizeBytes: number
  mimeType: string | null
  createdAt: string | null
}

type Props = {
  productId: number
  productName: string
  initialCount: number
}

const ACCEPTED = '.stl,.3mf,.obj,.step,.stp,.igs,.iges,.ply,.gcode,.zip'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ProductFilesDialog({ productId, productName, initialCount }: Props) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Attachment | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch(`/catalog/products/${productId}/files`, {
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const json = await res.json()
        setFiles(json.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) refresh()
  }, [open])  

  function pick() {
    if (busy) return
    inputRef.current?.click()
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

  function confirmRemove(file: Attachment) {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Manage 3D model files">
          <Paperclip className="size-4" />
          {initialCount > 0 ? <span className="text-xs">{initialCount}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>3D model files — {productName}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between gap-2 pb-2">
          <p className="text-xs text-muted-foreground">
            stl, 3mf, obj, step, stp, igs, iges, ply, gcode, zip — up to 50 MB each
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={onFileChange}
          />
          <Button onClick={pick} disabled={busy} size="sm">
            <Upload className="size-4" />
            {busy ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files attached yet.</p>
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
        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(o) => !o && setPending(null)}
          title={pending ? `Remove "${pending.originalName}"?` : ''}
          description="The file will be deleted from object storage. This cannot be undone."
          confirmLabel="Remove"
          variant="destructive"
          onConfirm={() => {
            if (pending) confirmRemove(pending)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
