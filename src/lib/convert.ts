import { dimensionError, isSvg } from './files'
import { readImageSize } from './imageSize'
import { WEBP_QUALITY } from './settings'
import type { EncodeRequest, EncodeResponse } from '../workers/encode.worker'

/** A problem with the image itself, with a message meant for the person converting it. */
export class ImageProblem extends Error {}

let worker: Worker | null = null
const pending = new Map<string, { resolve: (blob: Blob) => void; reject: (error: Error) => void }>()

/**
 * The worker itself broke (its script or WebAssembly failed to load, or it crashed), so no reply is
 * ever coming: fail everything waiting on it and let the next conversion start a fresh one.
 */
function discardWorker(message: string) {
  const jobs = [...pending.values()]
  pending.clear()
  worker?.terminate()
  worker = null
  for (const job of jobs) job.reject(new Error(message))
}

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
  worker.onerror = (event) => discardWorker(event.message || 'The image encoder stopped working')
  worker.onmessageerror = () => discardWorker('The image encoder sent back something unreadable')
  return worker
}

let warmed = false

/**
 * Starts the worker and its WebAssembly now, so the first conversion doesn't wait for them. Call it
 * when someone reaches for the drop field; it does nothing after the first time.
 */
export function warmUp() {
  if (warmed) return
  warmed = true
  getWorker().postMessage({ warm: true } satisfies EncodeRequest)
}

let nextId = 0

/** Encodes decoded pixels to WebP in the worker. Takes ownership of `image.data`'s buffer. */
export function encodeInWorker(image: ImageData, quality: number): Promise<Blob> {
  const id = String(nextId++)
  return new Promise<Blob>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, image, quality } satisfies EncodeRequest, [image.data.buffer])
  })
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
  let canvas: HTMLCanvasElement | null = null

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
    // Second check, for formats whose size can't be read from the header (SVG, ICO), before the canvas
    // allocates memory for every pixel.
    const tooLarge = dimensionError(width, height)
    if (tooLarge) throw new ImageProblem(tooLarge)
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Your browser couldn’t process this image')
    ctx.drawImage(source, 0, 0, width, height)
    return ctx.getImageData(0, 0, width, height)
  } finally {
    if (source instanceof ImageBitmap) source.close()
    if (url) URL.revokeObjectURL(url)
    // Free the canvas's pixel memory now rather than whenever garbage collection gets to it: Safari
    // is slow to reclaim canvases, and iOS caps their total memory, so a batch of big photos could
    // otherwise reach a point where drawImage silently paints nothing.
    if (canvas) canvas.width = canvas.height = 0
  }
}

/** Converts one image file to a WebP blob. Encoding runs in a worker so the page stays responsive. */
export async function convertToWebp(file: File, quality = WEBP_QUALITY): Promise<Blob> {
  // Reject oversized images from their header, before decoding allocates memory for every pixel.
  const declared = await readImageSize(file)
  const tooLarge = declared && dimensionError(declared.width, declared.height)
  if (tooLarge) throw new ImageProblem(tooLarge)

  return encodeInWorker(await decodeToImageData(file), quality)
}
