import { ChevronRight } from 'lucide-react'
import { usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'

import { navItems, type NavItem } from './sidebar_nav'
import type { Data } from '@generated/data'

type SidebarUser = NonNullable<Data.SharedProps['user']>

function hasPermission(user: SidebarUser | undefined, key?: string): boolean {
  if (!key) return true
  if (!user) return false
  return user.isOwner || user.permissions.includes(key)
}

function isVisible(item: NavItem, user: SidebarUser | undefined): boolean {
  if (item.children && item.children.length > 0) {
    return item.children.some((c) => isVisible(c, user))
  }
  return hasPermission(user, item.permission)
}

function isActive(itemUrl: string, currentUrl: string): boolean {
  if (itemUrl === '#') return false
  return currentUrl === itemUrl || currentUrl.startsWith(itemUrl + '/')
}

export function NavMain() {
  const { user, url } = usePage<Data.SharedProps>().props as unknown as {
    user: SidebarUser | undefined
    url: string
  }
  const currentUrl = usePage().url

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {navItems
          .filter((item) => isVisible(item, user))
          .map((item) => {
            if (!item.children || item.children.length === 0) {
              const active = isActive(item.url, currentUrl)
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={active}>
                    <Link href={item.url} prefetch>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            const visibleChildren = item.children.filter((c) => isVisible(c, user))
            const anyChildActive = visibleChildren.some((c) => isActive(c.url, currentUrl))

            return (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={anyChildActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title}>
                      <item.icon />
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {visibleChildren.map((child) => {
                        const active = isActive(child.url, currentUrl)
                        return (
                          <SidebarMenuSubItem key={child.title}>
                            <SidebarMenuSubButton asChild isActive={active}>
                              <Link href={child.url} prefetch>
                                <child.icon />
                                <span>{child.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
