import { Form } from '@adonisjs/inertia/react'
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

type InvitationProps = {
  token: string
  email: string | null
  emailLocked: boolean
  type: string
  role: string
}

export default function Invitation({
  token,
  email,
  emailLocked,
  type,
  role,
}: InvitationProps) {
  const heading = type === 'setup' ? 'Create the owner account' : 'Accept your invitation'
  const description =
    type === 'setup'
      ? 'No users exist yet. Set up the first account to take ownership.'
      : `You've been invited to join as ${role}.`

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <Form action={`/invite/${token}`} method="post">
          {({ errors, processing }) => (
            <>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={email ?? ''}
                    readOnly={emailLocked}
                    required={!emailLocked}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" name="firstName" autoComplete="given-name" required />
                    {errors.firstName && (
                      <p className="text-sm text-destructive">{errors.firstName}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" name="lastName" autoComplete="family-name" required />
                    {errors.lastName && (
                      <p className="text-sm text-destructive">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password_confirmation">Confirm password</Label>
                  <Input
                    id="password_confirmation"
                    name="password_confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="submit" disabled={processing}>
                  {processing ? 'Creating account…' : 'Create account'}
                </Button>
              </CardFooter>
            </>
          )}
        </Form>
      </Card>
    </div>
  )
}
