import Role from '#models/role'
import Invitation from '#models/invitation'
import User from '#models/user'
import { DateTime } from 'luxon'
import { permissions } from '#start/permissions'
import { assignableRoleIds } from '#services/role_hierarchy'

export type RoleListItem = {
  id: number
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  parentRoleId: number | null
  permissions: string[]
  assignable: boolean
}

export type PendingInvitationItem = {
  id: number
  email: string | null
  role: string
  type: 'setup' | 'invite'
  expiresAt: string | null
}

export type PermissionCatalogItem = {
  key: string
  description: string
}

export type RolesViewModel = {
  roles: RoleListItem[]
  permissionCatalog: PermissionCatalogItem[]
}

export type InvitationsViewModel = {
  roles: RoleListItem[]
  pendingInvitations: PendingInvitationItem[]
}

async function fetchRolesAndAssignable(user: User) {
  const [roles, assignable] = await Promise.all([
    Role.query().orderBy('name', 'asc'),
    assignableRoleIds(user),
  ])
  const assignableSet = new Set(assignable)
  return roles.map<RoleListItem>((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.displayName,
    description: r.description,
    isSystem: r.isSystem,
    parentRoleId: r.parentRoleId,
    permissions: r.permissions ?? [],
    assignable: assignableSet.has(r.id),
  }))
}

export async function getRolesViewModel(user: User): Promise<RolesViewModel> {
  const myPermissions = user.isOwner
    ? new Set(permissions.active())
    : new Set(await user.getPermissions())

  const roleList = await fetchRolesAndAssignable(user)

  return {
    roles: roleList,
    permissionCatalog: permissions
      .all()
      .filter((p) => myPermissions.has(p.key))
      .map<PermissionCatalogItem>((p) => ({ key: p.key, description: p.description })),
  }
}

export async function getInvitationsViewModel(user: User): Promise<InvitationsViewModel> {
  const [roleList, pending] = await Promise.all([
    fetchRolesAndAssignable(user),
    Invitation.query()
      .where('status', 'pending')
      .where('expires_at', '>', DateTime.now().toSQL()!)
      .preload('role')
      .orderBy('created_at', 'desc'),
  ])

  return {
    roles: roleList,
    pendingInvitations: pending.map<PendingInvitationItem>((i) => ({
      id: i.id,
      email: i.email,
      role: i.role?.displayName ?? '—',
      type: i.type as 'setup' | 'invite',
      expiresAt: i.expiresAt.toISO(),
    })),
  }
}

export type UserListRow = {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  isOwner: boolean
  roles: { id: number; name: string; displayName: string }[]
}

export type AssignableRoleOption = {
  id: number
  name: string
  displayName: string
}

export type UsersViewModel = {
  users: UserListRow[]
  assignableRoles: AssignableRoleOption[]
  currentUserId: number
}

/**
 * Build the User List view model.
 *
 * - Owners see every user.
 * - Non-owners see only users whose roles all sit inside their assignable
 *   subtree, excluding themselves and the workspace owner.
 *
 * Even users that the actor cannot edit (themselves, workspace owner) are
 * surfaced so the actor has visibility into who exists; the UI hides edit
 * actions for those rows and the server enforces it on POST.
 */
export async function getUsersViewModel(actor: User): Promise<UsersViewModel> {
  const allRoles = await Role.query().orderBy('display_name', 'asc')
  const assignableIds = actor.isOwner ? null : new Set(await assignableRoleIds(actor))

  const users = await User.query().preload('roles').orderBy('created_at', 'desc')

  const visibleUsers = actor.isOwner
    ? users
    : users.filter((u) => {
        if (u.id === actor.id) return true
        if (u.isOwner) return false
        if (u.roles.length === 0) return false
        return u.roles.every((r) => assignableIds!.has(r.id))
      })

  return {
    users: visibleUsers.map<UserListRow>((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isOwner: u.isOwner,
      roles: u.roles.map((r) => ({ id: r.id, name: r.name, displayName: r.displayName })),
    })),
    assignableRoles: allRoles
      .filter((r) => actor.isOwner || assignableIds!.has(r.id))
      .map<AssignableRoleOption>((r) => ({
        id: r.id,
        name: r.name,
        displayName: r.displayName,
      })),
    currentUserId: actor.id,
  }
}

/**
 * Final defensive guard for role-edit POSTs. Throws if any roleId is outside
 * the actor's assignable subtree. Owner bypasses the subtree check (still
 * verifies role existence). Owner role itself is never assignable here.
 */
export async function ensureRolesAssignable(actor: User, roleIds: number[]): Promise<void> {
  const found = await Role.query().whereIn('id', roleIds)
  if (found.length !== roleIds.length) {
    throw new Error('One or more roles do not exist.')
  }

  // Workspace-owner role cannot be assigned through this surface, even by owner.
  if (found.some((r) => r.name === 'owner')) {
    throw new Error('The owner role cannot be assigned.')
  }

  if (actor.isOwner) return

  const assignable = new Set(await assignableRoleIds(actor))
  const overstep = roleIds.filter((id) => !assignable.has(id))
  if (overstep.length > 0) {
    throw new Error('You cannot assign roles outside your subtree.')
  }
}
