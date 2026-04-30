function initialsFromEmail(email: string | null): string {
  if (!email) return '?'
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase() || '?'
}

export function userInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const first = firstName?.trim().charAt(0) ?? ''
  const last = lastName?.trim().charAt(0) ?? ''
  const combined = `${first}${last}`.toUpperCase()
  if (combined) return combined
  return initialsFromEmail(email ?? null)
}
