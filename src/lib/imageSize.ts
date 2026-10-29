export type Size = { width: number; height: number }

/** Enough of the file to reach the size field, even past a large EXIF block in a JPEG. */
const HEADER_BYTES = 256 * 1024

/**
 * Reads an image's width and height from its file header, without decoding any pixels.
 *
 * Decoding allocates memory for every pixel up front, so a tiny file that claims enormous
 * dimensions (a "decompression bomb") could crash the tab before we get a chance to reject it.
 * Checking the header first lets us refuse it cheaply. Returns null for formats it doesn't read
 * (SVG, ICO) or files it can't make sense of; those fall back to the check after decoding.
 */
export async function readImageSize(file: Blob): Promise<Size | null> {
  const bytes = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer())
  return sizeFromHeader(bytes)
}

export function sizeFromHeader(b: Uint8Array): Size | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const ascii = (at: number, length: number) => String.fromCharCode(...b.subarray(at, at + length))
  const has = (at: number, length: number) => at + length <= b.length

  // PNG: signature, then the IHDR chunk holds width and height (big-endian).
  if (has(0, 24) && b[0] === 0x89 && ascii(1, 3) === 'PNG' && ascii(12, 4) === 'IHDR') {
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }

  // GIF: logical screen size right after the signature (little-endian).
  if (has(0, 10) && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
  }

  // BMP: the DIB header stores width and height (height is negative for top-down images).
  if (has(0, 26) && ascii(0, 2) === 'BM') {
    return { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) }
  }

  // WebP: RIFF container with a VP8 (lossy), VP8L (lossless) or VP8X (extended) chunk.
  if (has(0, 30) && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4)
    if (chunk === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
    if (chunk === 'VP8L') {
      const bits = view.getUint32(21, true)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (chunk === 'VP8X') {
      const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16))
      const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16))
      return { width, height }
    }
    return null
  }

  // JPEG: walk the markers until a start-of-frame (SOFn), which holds height then width.
  if (has(0, 4) && b[0] === 0xff && b[1] === 0xd8) {
    let at = 2
    while (has(at, 9)) {
      if (b[at] !== 0xff) return null
      const marker = b[at + 1]
      if (marker === 0xff) {
        at++ // padding byte
        continue
      }
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isFrame) return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        at += 2 // markers without a length
        continue
      }
      at += 2 + view.getUint16(at + 2)
    }
    return null
  }

  // AVIF (and other ISO-BMFF images): the 'ispe' property box holds width and height.
  if (has(0, 12) && ascii(4, 4) === 'ftyp') {
    for (let at = 0; has(at, 16); at++) {
      if (b[at] === 0x69 && ascii(at, 4) === 'ispe') {
        return { width: view.getUint32(at + 8), height: view.getUint32(at + 12) }
      }
    }
    return null
  }

  return null
}
