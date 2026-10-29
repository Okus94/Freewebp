import { describe, expect, it } from 'vitest'
import {
  MAX_FILE_BYTES,
  dimensionError,
  formatBytes,
  isSvg,
  savingsPercent,
  toWebpName,
  uniqueName,
  validateFile,
} from './files'

describe('dimensionError', () => {
  it('allows images up to the WebP and memory limits', () => {
    expect(dimensionError(4032, 3024)).toBeNull()
    expect(dimensionError(16383, 100)).toBeNull()
    expect(dimensionError(7000, 7000)).toBeNull() // 49 MP
  })

  it('rejects sides beyond what WebP can store', () => {
    expect(dimensionError(17000, 200)).toBe('Too large: 17,000 × 200 px (max 16,383 px per side)')
  })

  it('rejects images with too many pixels', () => {
    expect(dimensionError(8000, 7000)).toBe('Too large: 56 MP (max 50 MP)')
  })
})

describe('validateFile', () => {
  it('accepts supported images by MIME type', () => {
    expect(validateFile({ name: 'a', type: 'image/png', size: 100 })).toBeNull()
    expect(validateFile({ name: 'a', type: 'image/avif', size: 100 })).toBeNull()
  })

  it('falls back to the extension when the browser gives no MIME type', () => {
    expect(validateFile({ name: 'favicon.ICO', type: '', size: 100 })).toBeNull()
  })

  it('rejects unsupported types', () => {
    expect(validateFile({ name: 'doc.pdf', type: 'application/pdf', size: 100 })).toMatch(/isn’t supported/)
  })

  it('rejects files over 10 MB', () => {
    expect(validateFile({ name: 'big.jpg', type: 'image/jpeg', size: MAX_FILE_BYTES + 1 })).toMatch(/10 MB/)
    expect(validateFile({ name: 'ok.jpg', type: 'image/jpeg', size: MAX_FILE_BYTES })).toBeNull()
  })
})

describe('isSvg', () => {
  it('detects SVGs by type or extension', () => {
    expect(isSvg({ name: 'x', type: 'image/svg+xml' })).toBe(true)
    expect(isSvg({ name: 'logo.svg', type: '' })).toBe(true)
    expect(isSvg({ name: 'logo.png', type: 'image/png' })).toBe(false)
  })
})

describe('toWebpName', () => {
  it('swaps the last extension for .webp', () => {
    expect(toWebpName('holiday.photo.JPG')).toBe('holiday.photo.webp')
    expect(toWebpName('noext')).toBe('noext.webp')
    expect(toWebpName('.png')).toBe('.png.webp')
  })
})

describe('uniqueName', () => {
  it('numbers duplicates before the extension', () => {
    const taken = new Set(['a.webp', 'a (1).webp'])
    expect(uniqueName('b.webp', taken)).toBe('b.webp')
    expect(uniqueName('a.webp', taken)).toBe('a (2).webp')
  })
})

describe('formatBytes', () => {
  it('formats bytes, KB and MB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(312 * 1024)).toBe('312 KB')
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2.4 MB')
  })
})

describe('savingsPercent', () => {
  it('reports savings and growth', () => {
    expect(savingsPercent(1000, 260)).toBe(74)
    expect(savingsPercent(1000, 1120)).toBe(-12)
    expect(savingsPercent(0, 10)).toBe(0)
  })
})
