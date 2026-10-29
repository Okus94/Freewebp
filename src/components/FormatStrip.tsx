import type { CSSProperties } from 'react'

const FORMATS = ['JPG', 'PNG', 'GIF', 'AVIF', 'BMP', 'SVG', 'ICO']

export function FormatStrip() {
  return (
    <ul
      aria-label="Supported formats"
      className="flex w-full flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 pt-16 sm:gap-x-20"
    >
      {FORMATS.map((format, i) => (
        // Follows the hero cascade, one format at a time.
        <li
          key={format}
          className="motion-rise text-[16px] leading-none font-medium tracking-[-0.2px] text-ink-muted sm:text-[18px]"
          style={{ '--delay': `${280 + i * 40}ms` } as CSSProperties}
        >
          {format}
        </li>
      ))}
    </ul>
  )
}
