import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Link2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  file: File | null | undefined
  onChange: (file: File | null) => void
  label?: string
  maxMb?: number
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function extensionFor(type: string) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

export function InlineImagePicker({ file, onChange, label = 'Add image', maxMb = 15 }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [loadingUrl, setLoadingUrl] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function acceptFile(nextFile: File | null) {
    if (!nextFile) {
      setPreviewUrl(null)
      onChange(null)
      return
    }
    if (!ALLOWED_TYPES.includes(nextFile.type)) {
      toast.error('Use a PNG, JPEG, or WebP image.')
      return
    }
    if (nextFile.size > maxMb * 1024 * 1024) {
      toast.error(`Image must be ${maxMb} MB or smaller.`)
      return
    }
    setPreviewUrl(URL.createObjectURL(nextFile))
    onChange(nextFile)
  }

  function handlePick() {
    inputRef.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    acceptFile(f)
  }

  function handleClear() {
    acceptFile(null)
  }

  async function useImageUrl() {
    const value = imageUrl.trim()
    if (!/^https?:\/\//i.test(value)) {
      toast.error('Enter a complete http:// or https:// image link.')
      return
    }
    setLoadingUrl(true)
    try {
      const response = await fetch(value)
      if (!response.ok) throw new Error('The image link could not be downloaded.')
      const blob = await response.blob()
      if (!ALLOWED_TYPES.includes(blob.type))
        throw new Error('The link is not a PNG, JPEG, or WebP image.')
      const linkedFile = new File([blob], `linked-image.${extensionFor(blob.type)}`, {
        type: blob.type,
      })
      acceptFile(linkedFile)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `${error.message} The website must allow browser downloads.`
          : 'The image link could not be downloaded.'
      )
    } finally {
      setLoadingUrl(false)
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const pasted = Array.from(event.clipboardData.files).find((item) =>
      item.type.startsWith('image/')
    )
    if (!pasted) return
    event.preventDefault()
    acceptFile(pasted)
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-dashed p-3"
      onPaste={handlePaste}
      tabIndex={0}
      aria-label="Image input. Paste an image here, choose a file, or enter an image link."
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex items-center gap-3">
        {file && previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Selected image preview"
              className="size-20 rounded-md border object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              onClick={handleClear}
              className="absolute -right-2 -top-2"
              aria-label="Remove image"
              title="Remove image"
            >
              <X />
            </Button>
          </div>
        ) : (
          <div className="flex size-20 items-center justify-center rounded-md border bg-muted text-muted-foreground">
            <ImagePlus />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <p className="text-sm font-medium">{file ? file.name : label}</p>
            <p className="text-xs text-muted-foreground">
              PNG, JPEG, or WebP up to {maxMb} MB. You can also press Ctrl+V.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handlePick} className="w-fit">
            <Upload data-icon="inline-start" />
            Choose file
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="url"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="https://example.com/image.png"
          aria-label="Image URL"
        />
        <Button
          type="button"
          variant="outline"
          onClick={useImageUrl}
          disabled={loadingUrl || !imageUrl.trim()}
        >
          <Link2 data-icon="inline-start" />
          {loadingUrl ? 'Loading…' : 'Use link'}
        </Button>
      </div>
    </div>
  )
}
