import { Image } from 'lucide-react'

// Placeholder lockup until the real logo is ready.
export function LogoHeader() {
  return (
    <header className="flex h-[72px] w-full shrink-0 items-center px-6 sm:px-24">
      <a href="/" className="flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-lg bg-rose text-white">
          <Image className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <span className="text-[19px] leading-[1.2] font-semibold tracking-[-0.38px]">WebP Converter</span>
      </a>
    </header>
  )
}
