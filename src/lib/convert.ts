import { dimensionError, isSvg } from './files'
import { WEBP_QUALITY } from './settings'
import type { EncodeRequest, EncodeResponse } from '../workers/encode.worker'

/** A problem with the image itself, with a message meant for the person converting it. */
export class ImageProblem extends Error {}

let worker: Worker | null = null
const pending = new Map<string, { resolve: (blob: Blob) => void; reject: (error: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/encode.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<EncodeResponse>) => {
    const job = pending.get(event.data.id)
    if (!job) return
    pending.delete(event.data.id)
    if ('error' in event.data) job.reject(new Error(event.data.error))
    else job.resolve(new Blob([event.data.buffer], { type: 'image/webp' }))
  }
  return worker
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Couldn’t read this image'))
    img.src = url
  })
}

/** Decodes any image the browser can open into raw RGBA pixels. */
async function decodeToImageData(file: File): Promise<ImageData> {
  let source: ImageBitmap | HTMLImageElement
  let width: number
  let height: number
  let url: string | null = null

  try {
    // createImageBitmap is fastest but can't read SVGs and, in some browsers, ICOs.
    if (isSvg(file)) throw new Error('svg')
    source = await createImageBitmap(file)
    width = source.width
    height = source.height
  } catch {
    url = URL.createObjectURL(file)
    source = await loadImageElement(url)
    width = source.naturalWidth
    height = source.naturalHeight
  }

  try {
    if (!width || !height) throw new ImageProblem('This image has no size')
    // Check before allocating the canvas, which is where an oversized image would exhaust memory.
    const tooLarge = dimensionError(width, height)
    if (tooLarge) throw new ImageProblem(tooLarge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Your browser couldn’t process this image')
    ctx.drawImage(source, 0, 0, width, height)
    return ctx.getImageData(0, 0, width, height)
  } finally {
    if (source instanceof ImageBitmap) source.close()
    if (url) URL.revokeObjectURL(url)
  }
}

let nextId = 0

/** Converts one image file to a WebP blob. Encoding runs in a worker so the page stays responsive. */
export async function convertToWebp(file: File, quality = WEBP_QUALITY): Promise<Blob> {
  const image = await decodeToImageData(file)
  const id = String(nextId++)
  return new Promise<Blob>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, image, quality } satisfies EncodeRequest, [image.data.buffer])
  })
}
