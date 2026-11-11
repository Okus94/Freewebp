import { ChromeFill } from '../components/ChromeOrb'
import { SubPage } from '../components/SubPage'

export function NotFoundPage() {
  return (
    <SubPage>
      <div className="flex w-full max-w-[640px] flex-col items-center gap-5 pt-24 text-center sm:pt-32">
        <p className="motion-rise text-[15px] font-medium text-ink-muted tabular-nums">404</p>
        <h1 className="motion-rise text-[40px] leading-[1.05] font-medium tracking-[-0.045em] sm:text-[56px]">
          This page doesn't exist
        </h1>
        <p className="motion-rise text-base text-ink-muted">The link may be old, or the address may have a typo.</p>
        {/* The same chrome as the upload button, so the way back reads as the site's main action. */}
        <a
          href="/"
          className="chrome motion-rise relative isolate mt-3 inline-flex h-11 items-center rounded-full px-6 text-[15px] font-medium text-white transition-transform duration-150 ease-fluid motion-safe:active:scale-[0.97]"
        >
          <ChromeFill />
          <span className="relative">Convert images to WebP</span>
        </a>
      </div>
    </SubPage>
  )
}
