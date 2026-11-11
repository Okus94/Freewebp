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
        <a
          href="/"
          className="motion-rise mt-3 inline-flex h-11 items-center rounded-full bg-ink px-6 text-[15px] font-medium text-paper transition-[transform,opacity] duration-150 ease-fluid hover:opacity-90 motion-safe:active:scale-[0.97]"
        >
          Convert images to WebP
        </a>
      </div>
    </SubPage>
  )
}
