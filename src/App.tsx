import type { CSSProperties } from 'react'
import { BackgroundGlow } from './components/BackgroundGlow'
import { DropField } from './components/DropField'
import { Faq } from './components/Faq'
import { FormatStrip } from './components/FormatStrip'
import { LogoHeader } from './components/LogoHeader'
import { ResultsList } from './components/ResultsList'
import { ShapeRain } from './components/ShapeRain'
import { useConverter } from './hooks/useConverter'
import { useShapesAfterDownload } from './hooks/useShapesAfterDownload'

/** Staggers the first-load entrance; 80ms apart reads as one cascade, not a queue. */
const delay = (ms: number) => ({ '--delay': `${ms}ms` }) as CSSProperties

export default function App() {
  const { items, notice, clearing, addFiles, remove, clear } = useConverter()
  const { showShapes, onDownloaded } = useShapesAfterDownload()

  return (
    // overflow-x-clip lets glows spill past the edges on small screens without making the page scroll sideways.
    <div className="relative isolate flex min-h-screen flex-col items-center overflow-x-clip">
      <BackgroundGlow />
      {/* 5 seconds after the first download, shapes tumble down behind the page. */}
      {showShapes && <ShapeRain />}
      <LogoHeader />

      <main className="flex w-full flex-col items-center">
        <section className="flex w-full flex-col items-center pb-20">
          <div className="flex w-full justify-center px-4 pt-16 sm:pt-24">
            <div className="flex w-full max-w-[640px] flex-col items-center text-center">
              <h1 className="motion-rise text-[40px] leading-[1.05] font-medium tracking-[-0.045em] sm:text-[66px] sm:whitespace-nowrap">
                Convert images to WebP
              </h1>
              <p className="motion-rise mt-[18px] text-base" style={delay(80)}>
                Smaller files, same quality — no uploads, no sign-up
              </p>
              <div className="motion-rise w-full" style={delay(160)}>
                <DropField onFiles={addFiles} />
              </div>
              {/* Only while the page is empty; it steps aside once there are files to download. */}
              {items.length === 0 && <FormatStrip />}
              {notice && (
                <p className="mt-3 text-[13px] leading-[1.3] text-rose transition-[opacity,translate] duration-200 ease-fluid starting:opacity-0 motion-safe:starting:-translate-y-1">
                  {notice}
                </p>
              )}
              {items.length > 0 && (
                <ResultsList items={items} clearing={clearing} onRemove={remove} onClear={clear} onDownloaded={onDownloaded} />
              )}
            </div>
          </div>
        </section>

        <div className="w-full max-w-[672px] px-4">
          <Faq />
        </div>
      </main>
    </div>
  )
}
