import { Data } from '@generated/data'
import { ReactElement } from 'react'

export default function Layout({ children }: { children: ReactElement<Data.SharedProps> }) {
  return (
    <>
      <main>{children}</main>
    </>
  )
}
