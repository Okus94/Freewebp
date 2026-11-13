import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Stands in for the browser's Worker: records what was posted and lets a test fire its events. */
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  posted: { id?: string; warm?: true }[] = []
  terminated = false
  postMessage(message: { id?: string; warm?: true }) {
    this.posted.push(message)
  }
  terminate() {
    this.terminated = true
  }
}

const workers: FakeWorker[] = []
const pixels = () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: 'srgb' }) as ImageData

let encodeInWorker: typeof import('./convert').encodeInWorker
let warmUp: typeof import('./convert').warmUp
let convertToWebp: typeof import('./convert').convertToWebp
let ImageProblem: typeof import('./convert').ImageProblem

beforeEach(async () => {
  workers.length = 0
  vi.stubGlobal(
    'Worker',
    class extends FakeWorker {
      constructor() {
        super()
        workers.push(this)
      }
    },
  )
  // A fresh module each time, so the worker singleton doesn't carry over between tests.
  vi.resetModules()
  ;({ encodeInWorker, warmUp, convertToWebp, ImageProblem } = await import('./convert'))
})

afterEach(() => vi.unstubAllGlobals())

describe('warmUp', () => {
  it('starts the worker and asks it to load the encoder, once', () => {
    warmUp()
    warmUp()
    expect(workers).toHaveLength(1)
    expect(workers[0].posted).toEqual([{ warm: true }])
  })

  it('shares the warmed worker with the first real job', () => {
    warmUp()
    const job = encodeInWorker(pixels(), 80)
    expect(workers).toHaveLength(1)
    expect(workers[0].posted).toHaveLength(2)
    workers[0].onmessage!({ data: { id: workers[0].posted[1].id, buffer: new ArrayBuffer(1) } } as MessageEvent)
    return expect(job).resolves.toBeInstanceOf(Blob)
  })
})

describe('encodeInWorker', () => {
  it('resolves each job with the bytes the worker sends back for it', async () => {
    const first = encodeInWorker(pixels(), 80)
    const second = encodeInWorker(pixels(), 80)
    const [worker] = workers
    expect(worker.posted.map((m) => m.id)).toHaveLength(2)

    worker.onmessage!({ data: { id: worker.posted[1].id, buffer: new Uint8Array([2]).buffer } } as MessageEvent)
    worker.onmessage!({ data: { id: worker.posted[0].id, buffer: new Uint8Array([1]).buffer } } as MessageEvent)
    expect(new Uint8Array(await (await first).arrayBuffer())).toEqual(new Uint8Array([1]))
    expect(new Uint8Array(await (await second).arrayBuffer())).toEqual(new Uint8Array([2]))
  })

  it('rejects a job the worker reports an encoding error for, and keeps the others', async () => {
    const failing = encodeInWorker(pixels(), 80)
    const fine = encodeInWorker(pixels(), 80)
    const [worker] = workers
    worker.onmessage!({ data: { id: worker.posted[0].id, error: 'too big' } } as MessageEvent)
    await expect(failing).rejects.toThrow('too big')
    worker.onmessage!({ data: { id: worker.posted[1].id, buffer: new ArrayBuffer(1) } } as MessageEvent)
    await expect(fine).resolves.toBeInstanceOf(Blob)
    expect(worker.terminated).toBe(false)
  })

  it('fails every waiting job when the worker itself breaks, instead of hanging', async () => {
    const jobs = [encodeInWorker(pixels(), 80), encodeInWorker(pixels(), 80), encodeInWorker(pixels(), 80)]
    const [worker] = workers
    worker.onerror!({ message: 'Script failed to load' } as ErrorEvent)
    for (const job of jobs) await expect(job).rejects.toThrow('Script failed to load')
    expect(worker.terminated).toBe(true)
  })

  it('starts a fresh worker for the next job after a failure', async () => {
    const broken = encodeInWorker(pixels(), 80)
    workers[0].onerror!({ message: '' } as ErrorEvent)
    await expect(broken).rejects.toThrow('The image encoder stopped working')

    const retry = encodeInWorker(pixels(), 80)
    expect(workers).toHaveLength(2)
    expect(workers[0].terminated).toBe(true)
    workers[1].onmessage!({ data: { id: workers[1].posted[0].id, buffer: new ArrayBuffer(1) } } as MessageEvent)
    await expect(retry).resolves.toBeInstanceOf(Blob)
  })

  it('treats an unreadable reply as a broken worker too', async () => {
    const job = encodeInWorker(pixels(), 80)
    workers[0].onmessageerror!({} as MessageEvent)
    await expect(job).rejects.toThrow('unreadable')
    expect(workers[0].terminated).toBe(true)
  })
})

describe('convertToWebp', () => {
  it('reports a file the browser cannot decode as a problem with the image, not a bug', async () => {
    // Neither decoder can read it: createImageBitmap rejects, and the <img> fallback fires onerror.
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('The source image could not be decoded')))
    vi.stubGlobal(
      'Image',
      class {
        onerror: (() => void) | null = null
        set src(_: string) {
          queueMicrotask(() => this.onerror?.())
        }
      },
    )
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} })

    const broken = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'broken.jpg', { type: 'image/jpeg' })
    const result = convertToWebp(broken)
    await expect(result).rejects.toBeInstanceOf(ImageProblem)
    await expect(result).rejects.toThrow('Couldn’t read this image')
    expect(workers, 'nothing was sent to the encoder').toHaveLength(0)
  })
})
