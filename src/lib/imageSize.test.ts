import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { readImageSize, sizeFromHeader } from './imageSize'

const W = 321
const H = 123
const pixels = () => sharp({ create: { width: W, height: H, channels: 4, background: '#b35f6b80' } })

/** Minimal 24-bit BMP header (sharp can't write BMP). */
function bmpHeader(width: number, height: number) {
  const b = new Uint8Array(54)
  const v = new DataView(b.buffer)
  b.set([0x42, 0x4d])
  v.setInt32(18, width, true)
  v.setInt32(22, height, true)
  return b
}

describe('readImageSize', () => {
  it.each([
    ['PNG', () => pixels().png().toBuffer()],
    ['JPEG', () => pixels().jpeg().toBuffer()],
    ['JPEG with EXIF', () => pixels().jpeg().withMetadata({ exif: { IFD0: { Copyright: 'x'.repeat(4000) } } }).toBuffer()],
    ['GIF', () => pixels().gif().toBuffer()],
    ['WebP lossy', () => pixels().webp({ quality: 80 }).toBuffer()],
    ['WebP lossless', () => pixels().webp({ lossless: true }).toBuffer()],
    ['AVIF', () => pixels().avif().toBuffer()],
  ])('reads %s dimensions without decoding', async (_, make) => {
    const file = new Blob([new Uint8Array(await make())])
    expect(await readImageSize(file)).toEqual({ width: W, height: H })
  })

  it('reads BMP dimensions, including top-down images', () => {
    expect(sizeFromHeader(bmpHeader(640, 480))).toEqual({ width: 640, height: 480 })
    expect(sizeFromHeader(bmpHeader(640, -480))).toEqual({ width: 640, height: 480 })
  })

  it('spots a tiny file claiming huge dimensions', () => {
    // A 24-byte PNG header claiming 60,000 × 60,000 pixels (3.6 billion pixels) — no pixel data at all.
    const bomb = new Uint8Array(24)
    bomb.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
    new DataView(bomb.buffer).setUint32(16, 60000)
    new DataView(bomb.buffer).setUint32(20, 60000)
    expect(sizeFromHeader(bomb)).toEqual({ width: 60000, height: 60000 })
  })

  it('returns null for formats it does not read, or garbage', async () => {
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'])
    expect(await readImageSize(svg)).toBeNull()
    expect(sizeFromHeader(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(sizeFromHeader(new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0]))).toBeNull()
  })
})
