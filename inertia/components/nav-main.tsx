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
  useSidebar,
} from '@/components/ui/sidebar'

import { navItems } from './sidebar_nav'
import { isActive, isVisible, type SidebarUser } from '@/lib/nav'
import type { Data } from '@generated/data'

export function NavMain() {
  const { user } = usePage<Data.SharedProps>().props as unknown as {
    user: SidebarUser | undefined
  }
  const currentUrl = usePage().url
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

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
                    <Link href={item.url} prefetch onClick={closeMobile}>
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
                              <Link href={child.url} prefetch onClick={closeMobile}>
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
