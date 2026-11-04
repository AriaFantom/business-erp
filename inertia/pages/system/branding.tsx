import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react'
import { router, useForm, usePage } from '@inertiajs/react'
import { Layers, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/confirm-dialog'
import DashboardLayout from '@/layouts/dashboard-layout'
import type { InertiaProps } from '@/types'

type Branding = { name: string; iconUrl: string | null }
type Props = { branding: Branding; currency: string; currencyOptions: string[] }

export default function ApplicationSettings({ branding, currency, currencyOptions }: Props) {
  const { user } = usePage<InertiaProps<Props>>().props
  const fileInput = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(branding.iconUrl)
  const [currencyConfirmOpen, setCurrencyConfirmOpen] = useState(false)
  const { data, setData, post, processing, errors } = useForm<{
    name: string
    currency: string
    icon: File | null
    removeIcon: boolean
  }>({ name: branding.name, currency, icon: null, removeIcon: false })

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  if (!user?.isOwner) return null

  const chooseIcon = (event: ChangeEvent<HTMLInputElement>) => {
    const icon = event.target.files?.[0] ?? null
    if (!icon) return
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(icon))
    setData((current) => ({ ...current, icon, removeIcon: false }))
  }

  const removeIcon = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setData((current) => ({ ...current, icon: null, removeIcon: true }))
    if (fileInput.current) fileInput.current.value = ''
  }

  const save = () => {
    post('/system/settings', {
      forceFormData: true,
      preserveScroll: true,
      preserveState: false,
      onSuccess: () => router.flushAll(),
    })
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (data.currency !== currency) setCurrencyConfirmOpen(true)
    else save()
  }

  const changed =
    data.name.trim() !== branding.name ||
    data.currency !== currency ||
    data.icon !== null ||
    data.removeIcon

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage the application identity and display currency.
        </p>
      </div>

      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle>Application settings</CardTitle>
            <CardDescription>
              The name and icon appear throughout the dashboard and invitation emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="dashboard-name">Business name</Label>
                <Input
                  id="dashboard-name"
                  value={data.name}
                  onChange={(event) => setData('name', event.target.value)}
                  maxLength={80}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={data.currency} onValueChange={(value) => setData('currency', value)}>
                  <SelectTrigger id="currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {currencyOptions.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This changes labels only. Existing amounts are not converted.
                </p>
                {errors.currency && <p className="text-sm text-destructive">{errors.currency}</p>}
              </div>
            </div>

            <div className="flex min-w-48 flex-col gap-3">
              <Label>Business icon</Label>
              <div className="flex items-center gap-4 md:flex-col md:items-start">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Business icon preview"
                      className="size-full object-cover"
                    />
                  ) : (
                    <Layers className="size-9" />
                  )}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={chooseIcon}
                  aria-label="Choose business icon"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload data-icon="inline-start" /> {previewUrl ? 'Replace' : 'Upload'}
                  </Button>
                  {previewUrl && (
                    <Button type="button" variant="ghost" onClick={removeIcon}>
                      <Trash2 data-icon="inline-start" /> Remove
                    </Button>
                  )}
                </div>
              </div>
              {errors.icon && <p className="text-sm text-destructive">{errors.icon}</p>}
              <p className="text-xs text-muted-foreground">JPG, PNG, or WebP up to 2 MB.</p>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={processing || !changed || !data.name.trim()}>
              {processing ? 'Saving…' : 'Save settings'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <ConfirmDialog
        open={currencyConfirmOpen}
        onOpenChange={setCurrencyConfirmOpen}
        title={`Change currency to ${data.currency}?`}
        description="All existing numbers will keep their current values and will be relabelled with the new currency. No exchange-rate conversion will be performed."
        confirmLabel="Change currency"
        onConfirm={save}
      />
    </div>
  )
}

ApplicationSettings.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
