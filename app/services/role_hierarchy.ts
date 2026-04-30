import type User from '#models/user'

/**
 * Effective priority for a user — the maximum priority across their roles,
 * or +Infinity for owners. Used to enforce hierarchy: a user can only act
 * on roles whose priority is strictly less than their own.
 */
export async function effectivePriority(user: User): Promise<number> {
  if (user.isOwner) return Number.POSITIVE_INFINITY
  const roles = await user.getRoles()
  return roles.reduce((max, r) => {
    const p = (r as unknown as { priority?: number }).priority ?? 0
    return p > max ? p : max
  }, 0)
}
