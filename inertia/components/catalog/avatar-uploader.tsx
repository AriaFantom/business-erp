import { useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  uploadPath: string
  imageUrl: string | null
  alt: string
  /** Square pixel size; defaults to 40 (h-10/w-10). */
  size?: number
}

export function AvatarUploader({ uploadPath, imageUrl, alt, size = 40 }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

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
        onFinish: () => setBusy(false),
      }
    )
  }

  return (
    <button
      type="button"
      onClick={pick}
      disabled={busy}
      aria-label={imageUrl ? `Replace image for ${alt}` : `Add image for ${alt}`}
      style={{ width: size, height: size }}
      className="group relative shrink-0 overflow-hidden rounded border border-border bg-muted text-[10px] text-muted-foreground transition hover:border-primary disabled:cursor-wait disabled:opacity-60"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : null}
      <span
        className={
          'absolute inset-0 flex items-center justify-center ' +
          (imageUrl
            ? 'bg-foreground/40 opacity-0 transition group-hover:opacity-100'
            : '')
        }
      >
        {busy ? (
          <Loader2
            className="animate-spin text-foreground"
            style={{ width: Math.max(16, Math.floor(size * 0.3)), height: Math.max(16, Math.floor(size * 0.3)) }}
          />
        ) : (
          <Plus
            className={imageUrl ? 'text-background' : ''}
            style={{ width: Math.max(16, Math.floor(size * 0.3)), height: Math.max(16, Math.floor(size * 0.3)) }}
          />
        )}
      </span>
    </button>
  )
}
