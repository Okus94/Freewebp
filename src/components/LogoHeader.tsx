// The sunflower on its own (public/logo-mark.svg) for the header; the favicon keeps it on a tile.
export function LogoHeader() {
  return (
    <header className="flex h-[72px] w-full shrink-0 items-center px-6 sm:px-24">
      <a href="/" className="flex items-center gap-2">
        <img src="/logo-mark.svg" alt="" width={36} height={36} className="size-9" />
        <span className="text-[19px] leading-[1.2] font-medium tracking-[-0.38px]">WebP Converter</span>
      </a>
    </header>
  )
}
