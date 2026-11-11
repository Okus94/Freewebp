import type { ReactNode } from 'react'
import { BackgroundGlow } from './BackgroundGlow'
import { LogoHeader } from './LogoHeader'
import { SiteFooter } from './SiteFooter'

/** The frame for pages other than the converter (privacy, 404): same header, glow and footer. */
export function SubPage({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center overflow-x-clip">
      <BackgroundGlow />
      <LogoHeader />
      <main className="flex w-full flex-1 flex-col items-center px-4">{children}</main>
      <SiteFooter />
    </div>
  )
}
