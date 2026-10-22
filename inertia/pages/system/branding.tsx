import { useRef, useState, type ChangeEvent, type ReactElement } from 'react'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import DashboardLayout from '@/layouts/dashboard-layout'
import type { InertiaProps } from '@/types'

type Branding = { name: string; iconUrl: string | null }

export default function DashboardBranding({ branding }: { branding: Branding }) {
  const { user } = usePage<InertiaProps>().props
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const { data, setData, post, processing, errors } = useForm({ name: branding.name })

  if (!user?.isOwner) return null

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const icon = event.target.files?.[0]
    if (!icon) return
    setUploading(true)
    setUploadError(null)
    router.post(
      '/system/branding/icon',
      { icon },
      {
        forceFormData: true,
        preserveScroll: true,
        preserveState: false,
        onSuccess: () => router.flushAll(),
        onError: (validation) =>
          setUploadError((validation.icon as string | undefined) ?? 'Upload failed.'),
        onFinish: () => {
          setUploading(false)
          if (fileInput.current) fileInput.current.value = ''
        },
      }
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard branding</h1>
        <p className="text-sm text-muted-foreground">
          Set the name and icon shown at the top of the application.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Dashboard name</CardTitle>
          <CardDescription>Shown to everyone in the navigation sidebar.</CardDescription>
        </CardHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            post('/system/branding', {
              preserveScroll: true,
              preserveState: false,
              onSuccess: () => router.flushAll(),
            })
          }}
        >
          <CardContent className="space-y-2">
            <Label htmlFor="dashboard-name">Name</Label>
            <Input
              id="dashboard-name"
              value={data.name}
              onChange={(event) => setData('name', event.target.value)}
              maxLength={80}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="submit"
              disabled={processing || !data.name.trim() || data.name.trim() === branding.name}
            >
              {processing ? 'Saving…' : 'Save name'}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Dashboard icon</CardTitle>
          <CardDescription>
            JPG, PNG, or WebP up to 2 MB. A square image works best.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-5">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            {branding.iconUrl ? (
              <img
                src={branding.iconUrl}
                alt="Current dashboard icon"
                className="size-full object-cover"
              />
            ) : (
              <Layers className="size-8" />
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={upload}
              aria-label="Choose dashboard icon"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                <Upload data-icon="inline-start" />{' '}
                {uploading ? 'Uploading…' : branding.iconUrl ? 'Replace icon' : 'Upload icon'}
              </Button>
              {branding.iconUrl && (
                <Button variant="ghost" disabled={uploading} onClick={() => setRemoveOpen(true)}>
                  <Trash2 data-icon="inline-start" /> Remove
                </Button>
              )}
            </div>
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove dashboard icon?"
        description="The default icon will be shown until you upload another one."
        confirmLabel="Remove icon"
        onConfirm={() =>
          router.post(
            '/system/branding/icon/delete',
            {},
            {
              preserveScroll: true,
              preserveState: false,
              onSuccess: () => router.flushAll(),
            }
          )
        }
      />
    </div>
  )
}

DashboardBranding.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
