import { useState } from 'react'
import { router } from '@inertiajs/react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { InlineImagePicker } from '@/components/catalog/inline-image-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  uploadPath: string
  imageUrl: string | null
  alt: string
  /** Square pixel size; defaults to 40 (h-10/w-10). */
  size?: number
  /** Max upload size in MB. Keep aligned with server validator. */
  maxMb?: number
}

export function AvatarUploader({ uploadPath, imageUrl, alt, size = 40, maxMb = 15 }: Props) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  function upload() {
    if (!file) return
    setBusy(true)
    router.post(
      uploadPath,
      { image: file },
      {
        forceFormData: true,
        preserveScroll: true,
        onError: (errors) => {
          const msg =
            (typeof errors === 'object' && errors && (errors.image || Object.values(errors)[0])) ||
            'Image upload failed.'
          toast.error(String(msg))
        },
        onSuccess: () => {
          setFile(null)
          setOpen(false)
        },
        onFinish: () => setBusy(false),
      }
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        aria-label={imageUrl ? `Replace image for ${alt}` : `Add image for ${alt}`}
        title={imageUrl ? 'Replace image' : 'Add image'}
        style={{ width: size, height: size }}
        className="group relative shrink-0 overflow-hidden rounded border border-border bg-muted text-[10px] text-muted-foreground transition hover:border-primary disabled:cursor-wait disabled:opacity-60"
      >
        {imageUrl ? (
          <img src={imageUrl} alt={alt} className="h-full w-full object-cover" loading="lazy" />
        ) : null}
        <span
          className={
            'absolute inset-0 flex items-center justify-center ' +
            (imageUrl ? 'bg-foreground/40 opacity-0 transition group-hover:opacity-100' : '')
          }
        >
          {busy ? (
            <Loader2 className="animate-spin text-foreground" />
          ) : (
            <Plus className={imageUrl ? 'text-background' : ''} />
          )}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{imageUrl ? 'Replace image' : 'Add image'}</DialogTitle>
            <DialogDescription>
              Choose a file, paste an image with Ctrl+V, or use a direct image link.
            </DialogDescription>
          </DialogHeader>
          <InlineImagePicker file={file} onChange={setFile} maxMb={maxMb} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={upload} disabled={!file || busy}>
              {busy ? 'Uploading…' : 'Upload image'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
