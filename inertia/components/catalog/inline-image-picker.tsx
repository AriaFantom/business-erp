import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

type Props = {
  file: File | null | undefined
  onChange: (file: File | null) => void
  label?: string
}

export function InlineImagePicker({ file, onChange, label = 'Add image' }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  function handlePick() {
    inputRef.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (f) {
      setPreviewUrl(URL.createObjectURL(f))
      onChange(f)
    } else {
      setPreviewUrl(null)
      onChange(null)
    }
  }

  function handleClear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    onChange(null)
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      {file && previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt="preview"
            className="h-16 w-16 rounded-md border object-cover"
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 ring-1 ring-border hover:bg-muted"
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted/50"
          aria-label={label}
          title={label}
        >
          <ImagePlus className="h-5 w-5" />
        </button>
      )}
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">
          {file ? file.name : label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          PNG, JPEG, WebP — up to 4 MB
        </span>
      </div>
    </div>
  )
}
