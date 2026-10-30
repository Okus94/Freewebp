import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { useBorderLight } from '../hooks/useBorderLight'
import { ChromeOrb } from './ChromeOrb'
import { ACCEPT_ATTRIBUTE } from '../lib/files'

export function DropField({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)
  const bulbRef = useRef<HTMLSpanElement>(null)
  const [dragging, setDragging] = useState(false)

  // The light travels round the border; dragging files over it speeds it up 3×, smoothly.
  useBorderLight(ringRef, bulbRef, dragging ? 3 : 1)

  const openPicker = () => inputRef.current?.click()

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length) onFiles(files)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drop images here, or press Enter to choose images"
      onClick={openPicker}
      onKeyDown={onKeyDown}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        // Ignore leaving into a child element; only reset when the pointer exits the field.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={onDrop}
      data-dragging={dragging}
      // Frosted glass with a travelling rainbow stroke (see .glass-field in index.css).
      // Lifts toward the files while dragging, gives a little under the press.
      className={`glass-field group mt-9 flex w-full cursor-pointer flex-col gap-[26px] rounded-[18px] border border-transparent px-5 pt-[18px] pb-3.5 text-left outline-none transition-[transform,background-color,box-shadow] duration-200 ease-fluid focus-visible:ring-2 focus-visible:ring-rose/40 motion-safe:active:scale-[0.99] ${
        dragging ? 'motion-safe:scale-[1.015]' : ''
      }`}
    >
      {/* The travelling light where it lights up the border. */}
      <span ref={ringRef} aria-hidden className="stroke-ring">
        <span ref={bulbRef} className="stroke-bulb" />
      </span>
      {/* Keyed so the label crossfades (through a slight blur) instead of snapping. */}
      <span
        key={dragging ? 'drop' : 'idle'}
        className="text-base leading-[1.4] text-ink-muted transition-[opacity,filter] duration-200 ease-fluid starting:opacity-0 starting:blur-[2px]"
      >
        {dragging ? 'Drop to convert' : 'Drop images here'}
      </span>
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <Plus className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
          <span className="text-[13px] leading-[1.3] text-ink-muted">JPG, PNG, GIF, AVIF · up to 10&nbsp;MB each</span>
        </div>
        <ChromeOrb />
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length) onFiles(files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
