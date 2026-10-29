import { zipSync } from 'fflate'
import { uniqueName } from './files'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before freeing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Bundles files into one ZIP. WebP is already compressed, so files are stored without recompressing. */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const taken = new Set<string>()
  const entries: Record<string, Uint8Array> = {}
  for (const file of files) {
    const name = uniqueName(file.name, taken)
    taken.add(name)
    entries[name] = new Uint8Array(await file.blob.arrayBuffer())
  }
  const zipped = zipSync(entries, { level: 0 })
  return new Blob([zipped], { type: 'application/zip' })
}
