import { useState } from 'react'
import { AlertCircle, Download, LoaderCircle, X } from 'lucide-react'
import type { ConvertItem } from '../hooks/useConverter'
import { downloadBlob, zipFiles } from '../lib/download'
import { formatBytes } from '../lib/files'

// Shared press feedback: a quick, subtle give under the pointer so every button feels heard.
const PRESS = 'transition-[transform,background-color,color,opacity] duration-150 ease-fluid motion-safe:active:scale-[0.96]'
// Things that appear on their own (like the download button) grow in from just below full size, never from nothing.
const POP_IN = 'transition-[opacity,scale] duration-200 ease-fluid starting:opacity-0 motion-safe:starting:scale-90'

function ResultRow({
  item,
  onRemove,
  onDownloaded,
}: {
  item: ConvertItem
  onRemove: (id: string) => void
  onDownloaded: () => void
}) {
  return (
    // The row opens its own height as it fades in (and closes it on the way out), so the list never jumps.
    <li
      className={`group/row grid transition-[grid-template-rows,opacity] ease-fluid starting:grid-rows-[0fr] starting:opacity-0 ${
        item.leaving ? 'grid-rows-[0fr] opacity-0 duration-150' : 'grid-rows-[1fr] opacity-100 duration-300'
      }`}
      style={{ transitionDelay: item.leaving ? '0ms' : `${Math.min(item.batchIndex, 8) * 40}ms` }}
    >
      <div className="min-h-0 overflow-hidden">
      {/* The first row gets 2px more above and below, optically balancing the card's rounded top. */}
      <div className="flex items-center gap-3 px-4 py-3 group-first/row:py-3.5">
        <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-field">
          {item.previewUrl && <img src={item.previewUrl} alt="" className="size-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] leading-[1.35] font-medium">{item.outputName}</p>
          {/* Keyed by status so each change crossfades through a light blur rather than swapping abruptly. */}
          <div
            key={item.status}
            className="mt-0.5 flex items-center gap-2 text-[13px] leading-[1.3] text-ink-muted tabular-nums transition-[opacity,filter] duration-200 ease-fluid starting:opacity-0 starting:blur-[2px]"
          >
            {item.status === 'error' && (
              <span className="flex items-center gap-1 text-rose">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                {item.error}
              </span>
            )}
            {(item.status === 'queued' || item.status === 'converting') && (
              <span>
                {formatBytes(item.file.size)} · {item.status === 'queued' ? 'Waiting…' : 'Converting…'}
              </span>
            )}
            {item.status === 'done' && item.output && (
              <span>
                {formatBytes(item.file.size)} → {formatBytes(item.output.size)}
              </span>
            )}
          </div>
        </div>
        {/* A quicker spin reads as quicker work. */}
        {item.status === 'converting' && (
          <LoaderCircle className="size-[18px] shrink-0 animate-[spin_0.7s_linear_infinite] text-ink-muted" aria-label="Converting" />
        )}
        {item.status === 'done' && item.output && (
          <button
            type="button"
            onClick={() => {
              downloadBlob(item.output!, item.outputName)
              onDownloaded()
            }}
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-ink hover:bg-field ${POP_IN} ${PRESS}`}
            aria-label={`Download ${item.outputName}`}
          >
            <Download className="size-[18px]" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-field hover:text-ink ${PRESS}`}
          aria-label={`Remove ${item.file.name}`}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      </div>
    </li>
  )
}

export function ResultsList({
  items,
  clearing,
  onRemove,
  onClear,
  onDownloaded,
}: {
  items: ConvertItem[]
  clearing: boolean
  onRemove: (id: string) => void
  onClear: () => void
  /** Called after every download (single file or ZIP). */
  onDownloaded: () => void
}) {
  const [zipping, setZipping] = useState(false)
  const done = items.filter((item): item is ConvertItem & { output: Blob } => item.status === 'done' && !!item.output)
  const busy = items.some((item) => item.status === 'queued' || item.status === 'converting')
  const before = done.reduce((sum, item) => sum + item.file.size, 0)
  const after = done.reduce((sum, item) => sum + item.output.size, 0)

  const downloadAll = async () => {
    if (done.length === 1) {
      downloadBlob(done[0].output, done[0].outputName)
      onDownloaded()
      return
    }
    setZipping(true)
    try {
      const zip = await zipFiles(done.map((item) => ({ name: item.outputName, blob: item.output })))
      downloadBlob(zip, 'webp-images.zip')
      onDownloaded()
    } finally {
      setZipping(false)
    }
  }

  return (
    // Rises in under the drop field; on Clear it settles back and fades, faster than it arrived.
    <div
      className={`mt-3 w-full overflow-hidden rounded-[18px] border border-hairline bg-white text-left transition-[opacity,transform] ease-fluid starting:opacity-0 motion-safe:starting:translate-y-2 ${
        clearing ? 'opacity-0 duration-150 motion-safe:scale-[0.98]' : 'duration-300'
      }`}
    >
      <ul aria-label="Converted images" className="divide-y divide-hairline">
        {items.map((item) => (
          <ResultRow key={item.id} item={item} onRemove={onRemove} onDownloaded={onDownloaded} />
        ))}
      </ul>
      <div className="glass-footer flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3">
        <p className="text-[13px] leading-[1.3] text-ink-muted tabular-nums">
          {done.length === 0
            ? busy
              ? 'Converting…'
              : 'Nothing converted yet'
            : `${done.length} of ${items.length} converted · ${formatBytes(Math.max(before - after, 0))} saved`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className={`rounded-full px-3.5 py-2 text-[14px] leading-[1.3] font-medium text-ink hover:bg-field ${PRESS}`}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={downloadAll}
            disabled={done.length === 0 || busy || zipping}
            className={`rounded-full bg-ink px-4 py-2 text-[14px] leading-[1.3] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${PRESS} disabled:active:scale-100`}
          >
            {zipping ? 'Preparing ZIP…' : done.length > 1 ? 'Download all (.zip)' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  )
}
