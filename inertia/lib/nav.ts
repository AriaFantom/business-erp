import { navItems, type NavItem } from '@/components/sidebar_nav'
import type { Data } from '@generated/data'

export type SidebarUser = NonNullable<Data.SharedProps['user']>
export type EnabledModules = string[] | undefined

export function hasPermission(user: SidebarUser | undefined, key?: string): boolean {
  if (!key) return true
  if (!user) return false
  return user.isOwner || user.permissions.includes(key)
}

/**
 * Module gate — independent of permissions. When `enabledModules` is undefined
 * (e.g. before shared props hydrate) we don't hide anything.
 */
export function isModuleEnabled(enabledModules: EnabledModules, key?: string): boolean {
  if (!key) return true
  if (!enabledModules) return true
  return enabledModules.includes(key)
}

export function isVisible(
  item: NavItem,
  user: SidebarUser | undefined,
  enabledModules?: EnabledModules
): boolean {
  if (item.children && item.children.length > 0) {
    return item.children.some((c) => isVisible(c, user, enabledModules))
  }
  return hasPermission(user, item.permission) && isModuleEnabled(enabledModules, item.module)
}

export function isActive(itemUrl: string, currentUrl: string): boolean {
  if (itemUrl === '#') return false
  return currentUrl === itemUrl || currentUrl.startsWith(itemUrl + '/')
}

export type NavLink = {
  title: string
  url: string
  icon: NavItem['icon']
  /** Parent group title when this link lives inside a collapsible section. */
  section?: string
}

/** Flattened, permission- and module-filtered leaf links — used by the command palette. */
export function visibleNavLinks(
  user: SidebarUser | undefined,
  enabledModules?: EnabledModules
): NavLink[] {
  const links: NavLink[] = []
  for (const item of navItems) {
    if (item.children && item.children.length > 0) {
      for (const child of item.children) {
        if (child.url !== '#' && isVisible(child, user, enabledModules)) {
          links.push({ title: child.title, url: child.url, icon: child.icon, section: item.title })
        }
      }
    } else if (item.url !== '#' && isVisible(item, user, enabledModules)) {
      links.push({ title: item.title, url: item.url, icon: item.icon })
    }
  }
  return links
}

export type Crumb = { title: string; url?: string }

/**
 * Build a breadcrumb trail from the nav definition and current URL.
 *
 * Matches the deepest nav leaf whose URL prefixes the path. List pages end at
 * the leaf; detail pages (`/orders/123`) keep the leaf as a link and append a
 * final crumb labelled with `detailLabel` (e.g. the record number).
 */
export function breadcrumbTrail(currentUrl: string, detailLabel?: string): Crumb[] {
  const path = currentUrl.split('?')[0]

  let bestSection: string | undefined
  let bestLeaf: NavItem | undefined
  for (const item of navItems) {
    const children = item.children && item.children.length > 0 ? item.children : [item]
    for (const child of children) {
      if (child.url === '#') continue
      if (path === child.url || path.startsWith(child.url + '/')) {
        if (!bestLeaf || child.url.length > bestLeaf.url.length) {
          bestLeaf = child
          bestSection = item.children && item.children.length > 0 ? item.title : undefined
        }
      }
    }
  }

  if (!bestLeaf) return []

  const isDetail = path !== bestLeaf.url
  const crumbs: Crumb[] = []
  if (bestSection) crumbs.push({ title: bestSection })
  crumbs.push({ title: bestLeaf.title, url: isDetail ? bestLeaf.url : undefined })
  if (isDetail) crumbs.push({ title: detailLabel ?? 'Details' })
  return crumbs
}
