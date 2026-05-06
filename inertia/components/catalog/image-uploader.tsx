import { useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'

type Props = {
  uploadPath: string
  deletePath: string
  hasImage: boolean
  label?: string
}

export function ImageUploader({ uploadPath, deletePath, hasImage, label }: Props) {
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
        onFinish: () => setBusy(false),
      }
    )
  }

  function remove() {
    if (busy) return
    if (!window.confirm('Remove image?')) return
    setBusy(true)
    router.post(
      deletePath,
      {},
      {
        preserveScroll: true,
        onFinish: () => setBusy(false),
      }
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={pick}
      >
        {label ?? (hasImage ? 'Replace image' : 'Upload image')}
      </Button>
      {hasImage && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={remove}
        >
          Remove
        </Button>
      )}
    </div>
  )
}
