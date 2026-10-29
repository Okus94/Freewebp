import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'
import { simd } from 'wasm-feature-detect'
import encode, { init } from '@jsquash/webp/encode'
import { unzipSync } from 'fflate'
import { zipFiles } from './download'

const require = createRequire(import.meta.url)

// In the browser the encoder fetches its own .wasm; in Node we hand it the compiled module.
beforeAll(async () => {
  const file = (await simd()) ? 'webp_enc_simd.wasm' : 'webp_enc.wasm'
  const wasm = readFileSync(require.resolve(`@jsquash/webp/codec/enc/${file}`))
  await init(await WebAssembly.compile(wasm))
})

function gradient(width: number, height: number, alpha = 255): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = (x / width) * 255
      data[i + 1] = (y / height) * 255
      data[i + 2] = 180
      data[i + 3] = alpha
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData
}

function webpHeader(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  return { riff: ascii(0, 4), webp: ascii(8, 12), chunk: ascii(12, 16) }
}

describe('WebP encoding', () => {
  it('produces a valid WebP file', async () => {
    const buffer = await encode(gradient(64, 48), { quality: 80 })
    expect(webpHeader(buffer)).toMatchObject({ riff: 'RIFF', webp: 'WEBP' })
    expect(buffer.byteLength).toBeLessThan(64 * 48 * 4)
  })

  it('keeps an alpha channel for transparent images', async () => {
    const buffer = await encode(gradient(32, 32, 128), { quality: 80 })
    // Lossy WebP with transparency uses the extended (VP8X) container.
    expect(webpHeader(buffer).chunk).toBe('VP8X')
  })

  it('makes smaller files at lower quality', async () => {
    const image = gradient(256, 256)
    const high = await encode(image, { quality: 95 })
    const low = await encode(image, { quality: 40 })
    expect(low.byteLength).toBeLessThan(high.byteLength)
  })
})

describe('zipFiles', () => {
  it('bundles files and de-duplicates names', async () => {
    const zip = await zipFiles([
      { name: 'a.webp', blob: new Blob([new Uint8Array([1, 2, 3])]) },
      { name: 'a.webp', blob: new Blob([new Uint8Array([4])]) },
    ])
    const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()))
    expect(Object.keys(entries).sort()).toEqual(['a (1).webp', 'a.webp'])
    expect(Array.from(entries['a.webp'])).toEqual([1, 2, 3])
  })
})
