import encode from '@jsquash/webp/encode'

export type EncodeRequest = { id: string; image: ImageData; quality: number }
export type EncodeResponse = { id: string; buffer: ArrayBuffer } | { id: string; error: string }

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  const { id, image, quality } = event.data
  try {
    const buffer = await encode(image, { quality })
    self.postMessage({ id, buffer } satisfies EncodeResponse, { transfer: [buffer] })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) } satisfies EncodeResponse)
  }
}
