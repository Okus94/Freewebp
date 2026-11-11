export function SiteFooter() {
  return (
    <footer className="flex w-full justify-center px-4 pt-16 pb-10">
      <nav aria-label="Site" className="flex items-center gap-6 text-[13px] leading-[1.3] text-ink-muted">
        <a href="/" className="transition-colors duration-150 hover:text-ink">
          Converter
        </a>
        <a href="/privacy/" className="transition-colors duration-150 hover:text-ink">
          Privacy
        </a>
      </nav>
    </footer>
  )
}
