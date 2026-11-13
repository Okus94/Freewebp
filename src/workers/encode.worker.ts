import encode, { init } from '@jsquash/webp/encode'

export type EncodeRequest = { id: string; image: ImageData; quality: number } | { warm: true }
export type EncodeResponse = { id: string; buffer: ArrayBuffer } | { id: string; error: string }

let codec: Promise<unknown> | null = null

/** Loads the WebAssembly encoder once; a failed load is forgotten so the next job tries again. */
function loadCodec() {
  codec ??= init().catch((error: unknown) => {
    codec = null
    throw error
  })
  return codec
}

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  const request = event.data
  if ('warm' in request) {
    // Pre-load while the person is still choosing files; any problem surfaces on the first real job.
    loadCodec().catch(() => {})
    return
  }
  const { id, image, quality } = request
  try {
    await loadCodec()
    const buffer = await encode(image, { quality })
    self.postMessage({ id, buffer } satisfies EncodeResponse, { transfer: [buffer] })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) } satisfies EncodeResponse)
  }
}
