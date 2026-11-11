// The sunflower app icon (public/favicon.svg) doubles as the logo mark.
export function LogoHeader() {
  return (
    <header className="flex h-[72px] w-full shrink-0 items-center px-6 sm:px-24">
      <a href="/" className="flex items-center gap-2.5">
        <img src="/favicon.svg" alt="" width={28} height={28} className="size-7" />
        <span className="text-[19px] leading-[1.2] font-semibold tracking-[-0.38px]">WebP Converter</span>
      </a>
    </header>
  )
}
