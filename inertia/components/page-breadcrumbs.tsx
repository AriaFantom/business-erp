import { Fragment } from 'react'
import { Head, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { breadcrumbTrail } from '@/lib/nav'

/**
 * Sniff a human label for a detail record from the page props. Most show pages
 * expose their entity under a single object prop with a `number` or `name`
 * field (`quotation.number`, `order.number`, product `name`, …); fall back to
 * undefined so the trail uses a generic label.
 */
function detailLabelFromProps(props: Record<string, unknown>): string | undefined {
  for (const value of Object.values(props)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>
      if (typeof obj.number === 'string' && obj.number) return obj.number
      if (typeof obj.name === 'string' && obj.name) return obj.name
      if (typeof obj.sku === 'string' && obj.sku) return obj.sku
    }
  }
  return undefined
}

export function PageBreadcrumbs() {
  const page = usePage()
  const label = detailLabelFromProps(page.props as Record<string, unknown>)
  const crumbs = breadcrumbTrail(page.url, label)

  if (crumbs.length === 0) return null

  const documentTitle = crumbs[crumbs.length - 1]?.title

  return (
    <>
      {documentTitle ? <Head title={documentTitle} /> : null}
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <Fragment key={`${crumb.title}-${i}`}>
                <BreadcrumbItem>
                  {crumb.url && !isLast ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.url}>{crumb.title}</Link>
                    </BreadcrumbLink>
                  ) : isLast ? (
                    <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                  ) : (
                    <span>{crumb.title}</span>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  )
}
