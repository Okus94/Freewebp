// Image quality metrics computed on luma (BT.601), the channel the eye is most sensitive to.

export type Rgba = { data: Uint8Array | Uint8ClampedArray; width: number; height: number }

function luma(image: Rgba): Float64Array {
  const { data, width, height } = image
  const out = new Float64Array(width * height)
  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    out[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return out
}

/** Peak signal-to-noise ratio over RGB, in dB. Higher is better; ~40 dB is visually very close. */
export function psnr(a: Rgba, b: Rgba): number {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = a.data[i + c] - b.data[i + c]
      sum += d * d
      n++
    }
  }
  const mse = sum / n
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse)
}

// 11-tap Gaussian, sigma 1.5: the window from the original SSIM paper (Wang et al., 2004).
const KERNEL = (() => {
  const k = Array.from({ length: 11 }, (_, i) => Math.exp(-((i - 5) ** 2) / (2 * 1.5 * 1.5)))
  const total = k.reduce((s, v) => s + v, 0)
  return k.map((v) => v / total)
})()

function blur(src: Float64Array, width: number, height: number): Float64Array {
  const tmp = new Float64Array(src.length)
  const out = new Float64Array(src.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0
      for (let k = -5; k <= 5; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + k))
        s += src[y * width + xx] * KERNEL[k + 5]
      }
      tmp[y * width + x] = s
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0
      for (let k = -5; k <= 5; k++) {
        const yy = Math.min(height - 1, Math.max(0, y + k))
        s += tmp[yy * width + x] * KERNEL[k + 5]
      }
      out[y * width + x] = s
    }
  }
  return out
}

/** Mean structural similarity. 1 means identical; above ~0.95 is hard to tell apart at normal size. */
export function ssim(a: Rgba, b: Rgba): number {
  const { width, height } = a
  const x = luma(a)
  const y = luma(b)
  const n = x.length
  const xx = new Float64Array(n)
  const yy = new Float64Array(n)
  const xy = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    xx[i] = x[i] * x[i]
    yy[i] = y[i] * y[i]
    xy[i] = x[i] * y[i]
  }
  const [mx, my, mxx, myy, mxy] = [x, y, xx, yy, xy].map((m) => blur(m, width, height))
  const c1 = (0.01 * 255) ** 2
  const c2 = (0.03 * 255) ** 2
  let total = 0
  for (let i = 0; i < n; i++) {
    const vx = mxx[i] - mx[i] * mx[i]
    const vy = myy[i] - my[i] * my[i]
    const cov = mxy[i] - mx[i] * my[i]
    total += ((2 * mx[i] * my[i] + c1) * (2 * cov + c2)) / ((mx[i] ** 2 + my[i] ** 2 + c1) * (vx + vy + c2))
  }
  return total / n
}

/** Flattens onto white so pixels hidden by transparency don't count as errors. */
export function onWhite(image: Rgba): Rgba {
  const data = new Uint8Array(image.data.length)
  for (let i = 0; i < data.length; i += 4) {
    const a = image.data[i + 3] / 255
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(image.data[i + c] * a + 255 * (1 - a))
    data[i + 3] = 255
  }
  return { ...image, data }
}

/** Largest per-pixel difference in the alpha channel (0 = transparency kept exactly). */
export function maxAlphaError(a: Rgba, b: Rgba): number {
  let max = 0
  for (let i = 3; i < a.data.length; i += 4) max = Math.max(max, Math.abs(a.data[i] - b.data[i]))
  return max
}
