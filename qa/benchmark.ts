// Compares the site's WebP encoder with Google's libwebp reference (via sharp, the same library cwebp uses)
// on the Kodak test photos plus a few synthetic images, then writes a report to .qa/report/.
//
//   npm run qa
//
// Exits with code 1 when the site's output is invalid or meaningfully worse than the reference.

import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join } from 'node:path'
import { performance } from 'node:perf_hooks'
import sharp from 'sharp'
import { simd } from 'wasm-feature-detect'
import encode, { init } from '@jsquash/webp/encode.js'
import { WEBP_QUALITY } from '../src/lib/settings.ts'
import { maxAlphaError, onWhite, psnr, ssim, type Rgba } from './metrics.ts'

const require = createRequire(import.meta.url)
const ROOT = new URL('../.qa/', import.meta.url).pathname
const KODAK = join(ROOT, 'corpus/kodak')
const SYNTHETIC = join(ROOT, 'corpus/synthetic')
const REPORT = join(ROOT, 'report')

// Pass criteria: the site may trail the reference by a hair, not by a visible margin.
const MAX_SSIM_DROP = 0.005
const MAX_SIZE_RATIO = 1.1
const MAX_ALPHA_ERROR = 8

async function ensureCorpus() {
  await mkdir(KODAK, { recursive: true })
  for (let i = 1; i <= 24; i++) {
    const name = `kodim${String(i).padStart(2, '0')}.png`
    const path = join(KODAK, name)
    if (existsSync(path)) continue
    const res = await fetch(`https://r0k.us/graphics/kodak/kodak/${name}`)
    if (!res.ok) throw new Error(`Couldn't download ${name}: ${res.status}`)
    await writeFile(path, Buffer.from(await res.arrayBuffer()))
  }

  await mkdir(SYNTHETIC, { recursive: true })
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <circle cx="256" cy="256" r="200" fill="#b35f6b"/>
    <rect x="166" y="166" width="180" height="180" rx="28" fill="none" stroke="#fff" stroke-width="22"/>
    <circle cx="216" cy="216" r="18" fill="#fff"/>
    <path d="M346 286 300 240a20 20 0 0 0-28 0L180 346" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round"/>
  </svg>`
  const screenshot = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
    <rect width="1280" height="800" fill="#fbf5f1"/>
    <rect x="0" y="0" width="1280" height="64" fill="#ffffff"/>
    <text x="40" y="42" font-family="Helvetica" font-size="22" font-weight="600" fill="#1e1a1b">Dashboard</text>
    ${Array.from({ length: 6 }, (_, i) => `
      <rect x="${40 + (i % 3) * 410}" y="${110 + Math.floor(i / 3) * 330}" width="380" height="300" rx="16" fill="#fff" stroke="#ece2e0"/>
      <text x="${64 + (i % 3) * 410}" y="${150 + Math.floor(i / 3) * 330}" font-family="Helvetica" font-size="17" fill="#685c5e">Revenue — Q${(i % 4) + 1} 2026</text>
      <text x="${64 + (i % 3) * 410}" y="${200 + Math.floor(i / 3) * 330}" font-family="Helvetica" font-size="38" font-weight="700" fill="#1e1a1b">$${(48210 + i * 7313).toLocaleString('en-US')}</text>
      <polyline points="${Array.from({ length: 12 }, (_, j) => `${64 + (i % 3) * 410 + j * 30},${370 + Math.floor(i / 3) * 330 - ((j * 37 + i * 11) % 90)}`).join(' ')}" fill="none" stroke="#b35f6b" stroke-width="3"/>`).join('')}
  </svg>`
  await sharp(Buffer.from(logo)).png().toFile(join(SYNTHETIC, 'logo-transparent.png'))
  await sharp(Buffer.from(screenshot)).png().toFile(join(SYNTHETIC, 'ui-screenshot.png'))
}

async function rgba(input: Buffer | string): Promise<Rgba> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function isWebp(buf: Uint8Array) {
  const ascii = (s: number, e: number) => String.fromCharCode(...buf.slice(s, e))
  return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
}

type Result = {
  name: string
  kind: 'photo' | 'synthetic'
  width: number
  height: number
  transparent: boolean
  original: number
  ours: { bytes: number; ms: number; ssim: number; psnr: number; alphaError: number; valid: boolean }
  ref: { bytes: number; ms: number; ssim: number; psnr: number }
  jpeg?: { bytes: number; ssim: number }
}

async function benchmark(path: string, kind: Result['kind']): Promise<Result> {
  const name = basename(path, '.png')
  const original = await rgba(path)
  const { width, height } = original
  const transparent = original.data.some((v, i) => i % 4 === 3 && v < 255)
  const image = { data: new Uint8ClampedArray(original.data), width, height, colorSpace: 'srgb' } as ImageData

  let t = performance.now()
  const oursBuf = new Uint8Array(await encode(image, { quality: WEBP_QUALITY }))
  const oursMs = performance.now() - t

  t = performance.now()
  const refBuf = await sharp(Buffer.from(original.data), { raw: { width, height, channels: 4 } })
    .webp({ quality: WEBP_QUALITY, effort: 4, alphaQuality: 100 })
    .toBuffer()
  const refMs = performance.now() - t

  const oursDecoded = await rgba(Buffer.from(oursBuf))
  const refDecoded = await rgba(refBuf)
  const valid = isWebp(oursBuf) && oursDecoded.width === width && oursDecoded.height === height
  const base = onWhite(original)

  let jpeg: Result['jpeg']
  if (!transparent) {
    const jpegBuf = await sharp(Buffer.from(original.data), { raw: { width, height, channels: 4 } })
      .jpeg({ quality: WEBP_QUALITY, mozjpeg: true })
      .toBuffer()
    jpeg = { bytes: jpegBuf.length, ssim: ssim(base, onWhite(await rgba(jpegBuf))) }
  }

  await writeFile(join(REPORT, 'images', `${name}.site.webp`), oursBuf)
  await writeFile(join(REPORT, 'images', `${name}.reference.webp`), refBuf)
  await copyFile(path, join(REPORT, 'images', `${name}.original.png`))

  return {
    name,
    kind,
    width,
    height,
    transparent,
    original: (await readFile(path)).length,
    ours: {
      bytes: oursBuf.length,
      ms: oursMs,
      ssim: ssim(base, onWhite(oursDecoded)),
      psnr: psnr(base, onWhite(oursDecoded)),
      alphaError: maxAlphaError(original, oursDecoded),
      valid,
    },
    ref: { bytes: refBuf.length, ms: refMs, ssim: ssim(base, onWhite(refDecoded)), psnr: psnr(base, onWhite(refDecoded)) },
    jpeg,
  }
}

const kb = (b: number) => `${(b / 1024).toFixed(1)} KB`
const pct = (a: number, b: number) => `${(((a - b) / b) * 100).toFixed(1)}%`
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

async function main() {
  await ensureCorpus()
  await mkdir(join(REPORT, 'images'), { recursive: true })

  const wasmFile = (await simd()) ? 'webp_enc_simd.wasm' : 'webp_enc.wasm'
  const module = await init(await WebAssembly.compile(await readFile(require.resolve(`@jsquash/webp/codec/enc/${wasmFile}`))))
  const v = (module as unknown as { version(): number }).version()
  const siteVersion = `${(v >> 16) & 0xff}.${(v >> 8) & 0xff}.${v & 0xff}`
  const refVersion = sharp.versions.webp

  const files = [
    ...(await readdir(KODAK)).filter((f) => f.endsWith('.png')).sort().map((f) => [join(KODAK, f), 'photo'] as const),
    ...(await readdir(SYNTHETIC)).filter((f) => f.endsWith('.png')).sort().map((f) => [join(SYNTHETIC, f), 'synthetic'] as const),
  ]

  const results: Result[] = []
  for (const [file, kind] of files) {
    const r = await benchmark(file, kind)
    results.push(r)
    console.log(
      `${r.name.padEnd(18)} site ${kb(r.ours.bytes).padStart(9)} ssim ${r.ours.ssim.toFixed(4)} ${r.ours.ms.toFixed(0).padStart(4)}ms | ` +
        `ref ${kb(r.ref.bytes).padStart(9)} ssim ${r.ref.ssim.toFixed(4)} | size ${pct(r.ours.bytes, r.ref.bytes).padStart(6)}`,
    )
  }

  const photos = results.filter((r) => r.kind === 'photo')
  const summary = {
    siteVersion,
    refVersion,
    quality: WEBP_QUALITY,
    images: results.length,
    siteBytes: sum(results.map((r) => r.ours.bytes)),
    refBytes: sum(results.map((r) => r.ref.bytes)),
    siteSsim: mean(results.map((r) => r.ours.ssim)),
    refSsim: mean(results.map((r) => r.ref.ssim)),
    sitePsnr: mean(results.map((r) => r.ours.psnr)),
    refPsnr: mean(results.map((r) => r.ref.psnr)),
    siteMsPerMp: mean(results.map((r) => r.ours.ms / ((r.width * r.height) / 1e6))),
    refMsPerMp: mean(results.map((r) => r.ref.ms / ((r.width * r.height) / 1e6))),
    photoVsPng: 1 - sum(photos.map((r) => r.ours.bytes)) / sum(photos.map((r) => r.original)),
    photoVsJpeg: 1 - sum(photos.map((r) => r.ours.bytes)) / sum(photos.map((r) => r.jpeg!.bytes)),
    jpegSsim: mean(photos.map((r) => r.jpeg!.ssim)),
  }

  const failures: string[] = []
  for (const r of results) {
    if (!r.ours.valid) failures.push(`${r.name}: output is not a valid WebP of the right size`)
    if (r.transparent && r.ours.alphaError > MAX_ALPHA_ERROR) failures.push(`${r.name}: transparency changed by up to ${r.ours.alphaError}/255`)
  }
  if (summary.siteSsim < summary.refSsim - MAX_SSIM_DROP)
    failures.push(`Mean SSIM ${summary.siteSsim.toFixed(4)} trails the reference ${summary.refSsim.toFixed(4)} by more than ${MAX_SSIM_DROP}`)
  if (summary.siteBytes > summary.refBytes * MAX_SIZE_RATIO)
    failures.push(`Total size is ${pct(summary.siteBytes, summary.refBytes)} vs the reference (limit +${((MAX_SIZE_RATIO - 1) * 100).toFixed(0)}%)`)

  await writeFile(join(REPORT, 'results.json'), JSON.stringify({ summary, results, failures }, null, 2))
  await writeFile(join(REPORT, 'index.html'), renderHtml(summary, results, failures))

  console.log(`
Site encoder:      libwebp ${siteVersion} (WebAssembly)   Reference: libwebp ${refVersion} (native)   Quality ${WEBP_QUALITY}
Total size:        site ${kb(summary.siteBytes)} vs reference ${kb(summary.refBytes)} (${pct(summary.siteBytes, summary.refBytes)})
Mean SSIM:         site ${summary.siteSsim.toFixed(4)} vs reference ${summary.refSsim.toFixed(4)}
Mean PSNR:         site ${summary.sitePsnr.toFixed(2)} dB vs reference ${summary.refPsnr.toFixed(2)} dB
Speed:             site ${summary.siteMsPerMp.toFixed(0)} ms/megapixel vs reference ${summary.refMsPerMp.toFixed(0)} ms/megapixel
Photos vs PNG:     ${(summary.photoVsPng * 100).toFixed(1)}% smaller
Photos vs JPEG:    ${(summary.photoVsJpeg * 100).toFixed(1)}% smaller than mozjpeg at quality ${WEBP_QUALITY} (JPEG SSIM ${summary.jpegSsim.toFixed(4)})
Report:            ${join(REPORT, 'index.html')}
${failures.length ? `\nFAILED:\n${failures.map((f) => `  - ${f}`).join('\n')}` : '\nPASSED'}`)
  process.exitCode = failures.length ? 1 : 0
}

function renderHtml(summary: Record<string, number | string>, results: Result[], failures: string[]) {
  const s = summary as Record<string, number>
  const rows = results
    .map(
      (r) => `<tr>
        <td>${r.name}${r.transparent ? ' <small>(transparent)</small>' : ''}</td>
        <td>${r.width}×${r.height}</td>
        <td>${kb(r.original)}</td>
        <td>${kb(r.ours.bytes)}</td><td>${kb(r.ref.bytes)}</td><td>${pct(r.ours.bytes, r.ref.bytes)}</td>
        <td>${r.ours.ssim.toFixed(4)}</td><td>${r.ref.ssim.toFixed(4)}</td>
        <td>${r.ours.psnr.toFixed(2)}</td><td>${r.ref.psnr.toFixed(2)}</td>
        <td>${r.ours.ms.toFixed(0)} ms</td>
      </tr>`,
    )
    .join('')
  const visuals = results
    .map(
      (r) => `<figure>
        <figcaption>${r.name}</figcaption>
        <div class="trio">
          <div><img src="images/${r.name}.original.png" alt=""><span>Original PNG · ${kb(r.original)}</span></div>
          <div><img src="images/${r.name}.site.webp" alt=""><span>This site · ${kb(r.ours.bytes)} · SSIM ${r.ours.ssim.toFixed(4)}</span></div>
          <div><img src="images/${r.name}.reference.webp" alt=""><span>libwebp reference · ${kb(r.ref.bytes)} · SSIM ${r.ref.ssim.toFixed(4)}</span></div>
        </div>
      </figure>`,
    )
    .join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>WebP QA report</title>
  <style>
    body{font:14px/1.5 -apple-system,system-ui,sans-serif;margin:32px;color:#1e1a1b;background:#fbf5f1}
    table{border-collapse:collapse;width:100%;background:#fff;margin:16px 0}
    th,td{border:1px solid #ece2e0;padding:6px 8px;text-align:right}th:first-child,td:first-child{text-align:left}
    .trio{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.trio img{width:100%;image-rendering:pixelated;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/16px 16px}
    .trio span{display:block;color:#685c5e;font-size:13px}figure{margin:24px 0}.fail{color:#b35f6b}.pass{color:#2f7d4f}
  </style></head><body>
  <h1>WebP QA report</h1>
  <p class="${failures.length ? 'fail' : 'pass'}"><strong>${failures.length ? 'FAILED' : 'PASSED'}</strong> ${failures.join(' · ')}</p>
  <p>Site encoder: libwebp ${summary.siteVersion} (WebAssembly) · Reference: libwebp ${summary.refVersion} (native, same library as cwebp) · Quality ${summary.quality}</p>
  <table><tr><th>Measure</th><th>This site</th><th>Reference</th></tr>
    <tr><td>Total size</td><td>${kb(s.siteBytes)}</td><td>${kb(s.refBytes)}</td></tr>
    <tr><td>Mean SSIM (1 = identical)</td><td>${s.siteSsim.toFixed(4)}</td><td>${s.refSsim.toFixed(4)}</td></tr>
    <tr><td>Mean PSNR</td><td>${s.sitePsnr.toFixed(2)} dB</td><td>${s.refPsnr.toFixed(2)} dB</td></tr>
    <tr><td>Speed</td><td>${s.siteMsPerMp.toFixed(0)} ms/MP</td><td>${s.refMsPerMp.toFixed(0)} ms/MP</td></tr>
  </table>
  <p>Photos are ${(s.photoVsPng * 100).toFixed(1)}% smaller than PNG and ${(s.photoVsJpeg * 100).toFixed(1)}% smaller than mozjpeg at the same quality setting (JPEG SSIM ${s.jpegSsim.toFixed(4)}).</p>
  <table><tr><th>Image</th><th>Size</th><th>Original</th><th>Site</th><th>Reference</th><th>Δ size</th><th>Site SSIM</th><th>Ref SSIM</th><th>Site PSNR</th><th>Ref PSNR</th><th>Site time</th></tr>${rows}</table>
  <h2>Side by side</h2>${visuals}
  </body></html>`
}

await main()
