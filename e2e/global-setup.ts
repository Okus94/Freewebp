// Generates one test file per supported format (plus a few bad ones) into .qa/fixtures/.

import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { FIXTURES, FIXTURE_DIR } from './fixtures'

/** A 240×160 colour gradient with a soft circle, so lossy artefacts would be visible. */
function photoPixels(width: number, height: number, alpha = false) {
  const channels = alpha ? 4 : 3
  const data = Buffer.alloc(width * height * channels)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const inCircle = (x - width / 2) ** 2 + (y - height / 2) ** 2 < (height / 3) ** 2
      data[i] = Math.round((x / width) * 255)
      data[i + 1] = inCircle ? 230 : Math.round((y / height) * 255)
      data[i + 2] = 140
      if (alpha) data[i + 3] = inCircle ? 255 : 0
    }
  }
  return sharp(data, { raw: { width, height, channels } })
}

/** Minimal 24-bit uncompressed BMP. */
async function bmp(width: number, height: number) {
  const { data } = await photoPixels(width, height).raw().toBuffer({ resolveWithObject: true })
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelBytes = rowSize * height
  const out = Buffer.alloc(54 + pixelBytes)
  out.write('BM', 0)
  out.writeUInt32LE(out.length, 2)
  out.writeUInt32LE(54, 10)
  out.writeUInt32LE(40, 14)
  out.writeInt32LE(width, 18)
  out.writeInt32LE(height, 22)
  out.writeUInt16LE(1, 26)
  out.writeUInt16LE(24, 28)
  out.writeUInt32LE(pixelBytes, 34)
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize // BMP rows are stored bottom-up
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 3
      out[row + x * 3] = data[src + 2]
      out[row + x * 3 + 1] = data[src + 1]
      out[row + x * 3 + 2] = data[src]
    }
  }
  return out
}

/** ICO containing a single PNG image (the modern ICO layout). */
async function ico(size: number) {
  const png = await photoPixels(size, size, true).png().toBuffer()
  const header = Buffer.alloc(22)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // one image
  header.writeUInt8(size, 6)
  header.writeUInt8(size, 7)
  header.writeUInt16LE(1, 10) // colour planes
  header.writeUInt16LE(32, 12) // bits per pixel
  header.writeUInt32LE(png.length, 14)
  header.writeUInt32LE(22, 18)
  return Buffer.concat([header, png])
}

export default async function globalSetup() {
  await mkdir(FIXTURE_DIR, { recursive: true })
  const write = (name: string, data: Buffer | string) => writeFile(`${FIXTURE_DIR}/${name}`, data)
  const byName = Object.fromEntries(FIXTURES.map((f) => [f.file, f]))

  await write('photo.jpg', await photoPixels(240, 160).jpeg({ quality: 90 }).toBuffer())
  await write('transparent.png', await photoPixels(240, 160, true).png().toBuffer())
  await write('animation.gif', await photoPixels(240, 160).gif().toBuffer())
  await write('photo.avif', await photoPixels(240, 160).avif({ quality: 70 }).toBuffer())
  await write('photo.bmp', await bmp(240, 160))
  // sharp can't read BMP, so tests compare the BMP's output against these identical pixels.
  await write('photo.bmp.reference.png', await photoPixels(240, 160).png().toBuffer())
  await write('icon.ico', await ico(64))
  await write(
    'vector.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${byName['vector.svg'].width}" height="${byName['vector.svg'].height}"><circle cx="100" cy="60" r="50" fill="#b35f6b"/></svg>`,
  )
  await write('already.webp', await photoPixels(240, 160).webp({ quality: 90 }).toBuffer())
  // Large photo for the speed check: 4000×3000 (12 megapixels), still under the 10 MB limit.
  await write('large.jpg', await photoPixels(4000, 3000).jpeg({ quality: 85 }).toBuffer())
  // Too big to convert, yet small files because they're a single flat colour.
  const flat = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: '#f4d9d9' } }).png({ compressionLevel: 9 }).toBuffer()
  await write('too-wide.png', await flat(17000, 200))
  // A "decompression bomb": a 24-byte PNG header claiming 60,000 × 60,000 pixels, with no pixel data.
  const bomb = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(bomb)
  bomb.writeUInt32BE(60000, 16)
  bomb.writeUInt32BE(60000, 20)
  await write('bomb.png', bomb)
  await write('too-many-pixels.png', await flat(8000, 7000))
  // Over the size limit; contents don't matter because size is checked first.
  await write('too-big.jpg', Buffer.alloc(11 * 1024 * 1024, 1))
  await write('notes.pdf', '%PDF-1.4 not an image')
}
