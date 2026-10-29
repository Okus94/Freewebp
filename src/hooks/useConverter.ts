import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageProblem, convertToWebp } from '../lib/convert'
import { MAX_FILES, toWebpName, validateFile } from '../lib/files'

export type ConvertItem = {
  id: string
  file: File
  previewUrl: string
  outputName: string
  status: 'queued' | 'converting' | 'done' | 'error'
  output?: Blob
  error?: string
  /** Position within the batch it was added in, used to stagger its entrance. */
  batchIndex: number
  /** True while its exit animation plays, just before it's removed. */
  leaving?: boolean
}

let nextId = 0

/** How long exit animations run before items are actually removed. Exits are quicker than entrances. */
const EXIT_MS = 180

export function useConverter() {
  const [items, setItems] = useState<ConvertItem[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const addFiles = useCallback((files: File[]) => {
    const room = MAX_FILES - itemsRef.current.length
    const accepted = files.slice(0, Math.max(room, 0))
    setNotice(
      files.length > accepted.length
        ? `You can convert up to ${MAX_FILES} images at a time — ${files.length - accepted.length} weren’t added.`
        : null,
    )
    if (accepted.length === 0) return
    const added = accepted.map<ConvertItem>((file, batchIndex) => {
      const error = validateFile(file)
      return {
        id: String(nextId++),
        file,
        previewUrl: error ? '' : URL.createObjectURL(file),
        outputName: toWebpName(file.name),
        status: error ? 'error' : 'queued',
        error: error ?? undefined,
        batchIndex,
      }
    })
    setItems((current) => [...current, ...added])
  }, [])

  // Convert one image at a time, so large batches don't hold every decoded image in memory at once.
  useEffect(() => {
    if (items.some((item) => item.status === 'converting')) return
    const next = items.find((item) => item.status === 'queued')
    if (!next) return
    setItems((current) => current.map((item) => (item.id === next.id ? { ...item, status: 'converting' } : item)))
    convertToWebp(next.file).then(
      (output) => {
        setItems((current) => current.map((item) => (item.id === next.id ? { ...item, status: 'done', output } : item)))
      },
      (error: unknown) => {
        const expected = error instanceof ImageProblem
        if (!expected) console.error(`Failed to convert ${next.file.name}`, error)
        const message = expected ? error.message : 'Couldn’t convert this image'
        setItems((current) =>
          current.map((item) => (item.id === next.id ? { ...item, status: 'error', error: message } : item)),
        )
      },
    )
  }, [items])

  const remove = useCallback((id: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, leaving: true } : item)))
    setNotice(null)
    setTimeout(() => {
      setItems((current) => {
        const item = current.find((i) => i.id === id)
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
        return current.filter((i) => i.id !== id)
      })
    }, EXIT_MS)
  }, [])

  const clear = useCallback(() => {
    // Only clear what's listed now, so images dropped during the exit animation survive it.
    const ids = new Set(itemsRef.current.map((item) => item.id))
    setClearing(true)
    setNotice(null)
    setTimeout(() => {
      setItems((current) => {
        current.forEach((item) => ids.has(item.id) && item.previewUrl && URL.revokeObjectURL(item.previewUrl))
        return current.filter((item) => !ids.has(item.id))
      })
      setClearing(false)
    }, EXIT_MS)
  }, [])

  useEffect(() => () => itemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl)), [])

  return { items, notice, clearing, addFiles, remove, clear }
}
