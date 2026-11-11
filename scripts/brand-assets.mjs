// Builds the raster brand files in public/ from the sunflower SVG and the site font, so they stay in
// step with the logo: the link-preview image (og.png), the iOS home-screen icon, the web-app icons
// and favicon.ico. Run `npm run assets` after changing public/favicon.svg.
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const read = (path) => readFileSync(new URL(path, import.meta.url))
const logo = read('../public/favicon.svg').toString()
const font = read('../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2').toString('base64')

// Home-screen and app icons get square corners: iOS and Android round them themselves.
const fullBleed = logo.replaceAll('rx="23"', 'rx="0"').replace(/<rect x="0\.5"[^>]*\/>/, '')

const page = (body, css = '') => `<!doctype html><html><head><style>
  @font-face { font-family: Geist; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
  html, body { margin: 0; background: transparent; }
  svg { display: block; width: 100%; height: 100%; }
  ${css}
</style></head><body>${body}</body></html>`

const browser = await chromium.launch()
const shoot = async (html, width, height, path, transparent = false) => {
  const tab = await browser.newPage({ viewport: { width, height } })
  await tab.setContent(html)
  await tab.evaluate(() => document.fonts.ready)
  const png = await tab.screenshot({ omitBackground: transparent })
  await tab.close()
  if (path) writeFileSync(new URL(path, import.meta.url), png)
  return png
}

// Link preview, 1200×630: the hero in miniature on the site's paper and glow.
await shoot(
  page(
    `<div class="card"><div class="logo">${logo}</div><h1>Convert images to WebP</h1>
     <p>Smaller files, same quality. No uploads, no sign-up</p><span>freewebp.org</span></div>`,
    `.card { width: 1200px; height: 630px; box-sizing: border-box; display: flex; flex-direction: column;
        align-items: center; justify-content: center; font-family: Geist; color: #1e1a1b;
        background: radial-gradient(circle at 50% 45%, #f4d9d9 0%, #fbf5f1 62%); }
     .logo { width: 148px; height: 148px; margin-bottom: 40px; filter: drop-shadow(0 18px 30px rgb(179 95 107 / 0.28)); }
     h1 { margin: 0; font-size: 84px; line-height: 1.05; font-weight: 500; letter-spacing: -0.045em; }
     p { margin: 22px 0 0; font-size: 30px; color: #685c5e; letter-spacing: -0.01em; }
     span { margin-top: 44px; font-size: 22px; font-weight: 500; color: #b35f6b; }`,
  ),
  1200,
  630,
  '../public/og.png',
)

const icon = (size) => shoot(page(`<div style="width:${size}px;height:${size}px">${fullBleed}</div>`), size, size)
writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), await icon(180))
writeFileSync(new URL('../public/icon-192.png', import.meta.url), await icon(192))
writeFileSync(new URL('../public/icon-512.png', import.meta.url), await icon(512))

// favicon.ico for older browsers and crawlers: one 32px PNG in an ICO wrapper (the format allows PNG inside).
const small = await shoot(page(`<div style="width:32px;height:32px">${logo}</div>`), 32, 32, null, true)
const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // one image
header.writeUInt8(32, 6) // width
header.writeUInt8(32, 7) // height
header.writeUInt16LE(1, 10) // colour planes
header.writeUInt16LE(32, 12) // bits per pixel
header.writeUInt32LE(small.length, 14)
header.writeUInt32LE(22, 18) // image data starts after this header
writeFileSync(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([header, small]))

await browser.close()
console.log('Brand assets written to public/')
