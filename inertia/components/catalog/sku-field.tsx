import { useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateSku } from '@/lib/sku'

type Props = {
  /** The item name the SKU is suggested from. */
  name: string
  value: string
  onChange: (sku: string) => void
  error?: string
  id?: string
}

/**
 * SKU input that suggests a code from the item name.
 *
 * The suggestion keeps tracking the name until the user edits the SKU by hand;
 * from then on it is left alone. The refresh button always re-rolls a fresh
 * code and hands control back to auto-fill.
 */
export function SkuField({ name, value, onChange, error, id = 'sku' }: Props) {
  const editedByHand = useRef(false)
  // Only regenerate when the name actually changes, not on every keystroke in
  // the SKU box.
  const lastName = useRef(name)

  useEffect(() => {
    if (name === lastName.current) return
    lastName.current = name
    if (editedByHand.current) return
    onChange(name.trim() ? generateSku(name) : '')
    // onChange is a form setter with a fresh identity each render, so this
    // effect re-runs often — the lastName guard above is what makes it a no-op
    // unless the name actually changed.
  }, [name, onChange])

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>SKU</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            editedByHand.current = true
            onChange(e.target.value)
          }}
          className="font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Generate a new SKU"
          title="Generate a new SKU"
          onClick={() => {
            editedByHand.current = false
            onChange(generateSku(name))
          }}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Filled in from the name — edit it or hit refresh for another.
      </p>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
