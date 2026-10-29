export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_FILES = 20
/** The WebP format can't store images wider or taller than this. */
export const MAX_SIDE = 16383
/** Keeps memory in check: a 50 MP image needs ~200 MB of pixels while converting. */
export const MAX_PIXELS = 50_000_000

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/webp',
]

const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'avif', 'bmp', 'svg', 'ico', 'webp']

/** Value for the file input's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = [...ACCEPTED_TYPES, ...ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`)].join(',')

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Returns an error message for a file we can't convert, or null when it's fine. */
export function validateFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const typeOk = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))
  if (!typeOk) return 'This file type isn’t supported'
  if (file.size > MAX_FILE_BYTES) return 'Larger than 10 MB'
  return null
}

/** Returns an error message for images too big to convert, or null when the size is fine. */
export function dimensionError(width: number, height: number): string | null {
  if (width > MAX_SIDE || height > MAX_SIDE) {
    return `Too large: ${width.toLocaleString('en-US')} × ${height.toLocaleString('en-US')} px (max ${MAX_SIDE.toLocaleString('en-US')} px per side)`
  }
  if (width * height > MAX_PIXELS) {
    return `Too large: ${Math.round((width * height) / 1e6)} MP (max ${MAX_PIXELS / 1e6} MP)`
  }
  return null
}

export function isSvg(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type === 'image/svg+xml' || extensionOf(file.name) === 'svg'
}

/** "holiday.photo.JPG" -> "holiday.photo.webp" */
export function toWebpName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base || 'image'}.webp`
}

/** Picks a name not in `taken`, adding " (1)", " (2)"… before the extension. */
export function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let n = 1
  while (taken.has(`${base} (${n})${ext}`)) n++
  return `${base} (${n})${ext}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

/** Percentage saved going from `before` to `after` bytes; negative when the file grew. */
export function savingsPercent(before: number, after: number): number {
  if (before <= 0) return 0
  return Math.round(((before - after) / before) * 100)
}
