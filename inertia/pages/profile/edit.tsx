import { useRef, useState, type ChangeEvent, type ReactElement } from 'react'
import { router, useForm, usePage } from '@inertiajs/react'
import { ArrowLeft, Trash2, Upload } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import DashboardLayout from '@/layouts/dashboard-layout'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { userInitials } from '@/lib/user'
import type { InertiaProps } from '@/types'

export default function ProfileEdit() {
  const { user } = usePage<InertiaProps>().props
  if (!user) return null

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.visit('/dashboard')}>
          <ArrowLeft />
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">Update your name and avatar.</p>
        </div>
      </div>

      <AvatarCard
        avatarUrl={user.avatarUrl}
        initials={userInitials(user.firstName, user.lastName, user.email)}
      />

      <ProfileCard initialFirstName={user.firstName ?? ''} initialLastName={user.lastName ?? ''} />
    </div>
  )
}

function ProfileCard({
  initialFirstName,
  initialLastName,
}: {
  initialFirstName: string
  initialLastName: string
}) {
  const { data, setData, post, processing, errors } = useForm({
    firstName: initialFirstName,
    lastName: initialLastName,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal info</CardTitle>
        <CardDescription>Shown on your dashboard and in audit trails.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          post('/profile', { preserveScroll: true })
        }}
      >
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-first-name">First name</Label>
            <Input
              id="profile-first-name"
              name="firstName"
              placeholder="Your first name"
              value={data.firstName}
              onChange={(e) => setData('firstName', e.target.value)}
              aria-invalid={errors.firstName ? true : undefined}
            />
            {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-last-name">Last name</Label>
            <Input
              id="profile-last-name"
              name="lastName"
              placeholder="Your last name"
              value={data.lastName}
              onChange={(e) => setData('lastName', e.target.value)}
              aria-invalid={errors.lastName ? true : undefined}
            />
            {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={processing}>
            {processing ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function AvatarCard({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null | undefined
  initials: string
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const onFileChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) return

    setPreviewUrl(URL.createObjectURL(file))
    setUploadError(null)
    setProcessing(true)

    router.post(
      '/profile/avatar',
      { avatar: file },
      {
        preserveScroll: true,
        forceFormData: true,
        onError: (errors) => {
          const message =
            (errors.avatar as string | undefined) ?? 'Upload failed. Please try again.'
          setUploadError(message)
          setPreviewUrl(null)
        },
        onFinish: () => {
          setProcessing(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        },
      }
    )
  }

  const [removeOpen, setRemoveOpen] = useState(false)
  const onRemove = () => setRemoveOpen(true)
  const confirmRemove = () => router.post('/profile/avatar/delete', {}, { preserveScroll: true })

  const displayUrl = previewUrl ?? avatarUrl ?? undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avatar</CardTitle>
        <CardDescription>JPG, PNG, or WebP. Max 2 MB.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <Avatar size="lg" className="size-20">
          {displayUrl && <AvatarImage src={displayUrl} alt="" />}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChosen}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload />
              {processing ? 'Uploading…' : avatarUrl ? 'Replace' : 'Upload'}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={processing}
                onClick={onRemove}
              >
                <Trash2 />
                Remove
              </Button>
            )}
          </div>
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </div>
      </CardContent>
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove your avatar?"
        description="Your avatar will be deleted from storage. You can upload a new one later."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={confirmRemove}
      />
    </Card>
  )
}

ProfileEdit.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
