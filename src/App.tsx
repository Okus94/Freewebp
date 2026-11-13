import { useEffect, useRef, type CSSProperties } from 'react'
import { BackgroundGlow } from './components/BackgroundGlow'
import { DropField } from './components/DropField'
import { Faq } from './components/Faq'
import { FormatStrip } from './components/FormatStrip'
import { LogoHeader } from './components/LogoHeader'
import { ResultsList } from './components/ResultsList'
import { ShapeRain } from './components/ShapeRain'
import { SiteFooter } from './components/SiteFooter'
import { useConverter } from './hooks/useConverter'
import { useShapesAfterDownload } from './hooks/useShapesAfterDownload'
import { describeProgress } from './lib/announce'

/** Staggers the first-load entrance; 80ms apart reads as one cascade, not a queue. */
const delay = (ms: number) => ({ '--delay': `${ms}ms` }) as CSSProperties

export default function App() {
  const { items, notice, clearing, addFiles, remove, clear } = useConverter()
  const { showShapes, onDownloaded } = useShapesAfterDownload()
  /** The drop field, where focus returns when the list empties. */
  const fieldRef = useRef<HTMLDivElement>(null)

  // A drop that misses the field would make the browser open the file in place of the page,
  // losing every converted image. The field handles its own drops; everywhere else, do nothing.
  useEffect(() => {
    const prevent = (event: DragEvent) => event.preventDefault()
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', prevent)
    }
  }, [])

  return (
    // overflow-x-clip lets glows spill past the edges on small screens without making the page scroll sideways.
    <div className="relative isolate flex min-h-screen flex-col items-center overflow-x-clip">
      <BackgroundGlow />
      {/* 5 seconds after the first download, shapes tumble down behind the page. */}
      {showShapes && <ShapeRain />}
      <LogoHeader />

      <main className="flex w-full flex-col items-center">
        <section className="flex w-full flex-col items-center pb-12 sm:pb-16">
          <div className="flex w-full justify-center px-4 pt-16 sm:pt-24">
            <div className="flex w-full max-w-[640px] flex-col items-center text-center">
              {/* One line at every width: the size tracks the viewport between 640px and ~768px,
                  where a fixed 66px would be wider than the screen and get clipped. */}
              <h1 className="motion-rise text-[40px] leading-[1.05] font-medium tracking-[-0.045em] sm:text-[clamp(44px,8.6vw,66px)] sm:whitespace-nowrap">
                Convert images to WebP
              </h1>
              <p className="motion-rise mt-[18px] text-base text-balance" style={delay(80)}>
                Smaller files, same quality. No uploads, no sign-up
              </p>
              <div className="motion-rise w-full" style={delay(160)}>
                <DropField ref={fieldRef} onFiles={addFiles} />
              </div>
              {/* Only while the page is empty; it steps aside once there are files to download. */}
              {items.length === 0 && <FormatStrip />}
              {/* Live regions are always in the page, so screen readers announce what appears in them. */}
              <div role="status">
                {notice && (
                  <p className="mt-3 text-[13px] leading-[1.3] text-rose transition-[opacity,translate] duration-200 ease-fluid starting:opacity-0 motion-safe:starting:-translate-y-1">
                    {notice}
                  </p>
                )}
              </div>
              <p role="status" className="sr-only">
                {describeProgress(items)}
              </p>
              {items.length > 0 && (
                <ResultsList
                  items={items}
                  clearing={clearing}
                  fieldRef={fieldRef}
                  onRemove={remove}
                  onClear={clear}
                  onDownloaded={onDownloaded}
                />
              )}
            </div>
          </div>
        </section>

        <div className="w-full max-w-[672px] px-4">
          <Faq />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
