# WebP Converter

Convert JPG, PNG, GIF, AVIF, BMP, SVG and ICO images to WebP in the browser. Nothing is uploaded: images are decoded with the browser's own decoders and encoded with [libwebp compiled to WebAssembly](https://github.com/jamsinclair/jSquash/tree/main/packages/webp), running in a web worker.

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests, including real WebP encoding
npm run build    # type-check and build the static site into dist/
```

`dist/` is a static site: deploy it to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).

## How it works

- `src/lib/convert.ts` — decodes a file to pixels (`createImageBitmap`, or an `<img>` for SVG/ICO) and sends them to the worker.
- `src/workers/encode.worker.ts` — encodes the pixels to WebP at quality 80 (`WEBP_QUALITY`).
- `src/hooks/useConverter.ts` — the queue: validates files (10 MB each, 20 at a time) and converts one at a time.
- `src/lib/download.ts` — single downloads and the ZIP for "Download all".

## QA

```sh
npm run qa         # quality benchmark: this site's encoder vs Google's libwebp on the Kodak test photos
npm run test:e2e   # real-browser tests (Chromium and WebKit/Safari) against the production build
```

`npm run qa` downloads the 24 Kodak test photos once, encodes each with the site's encoder and with libwebp (through sharp, the same library as `cwebp`), and compares size, SSIM, PSNR and speed. It fails if the site's output is invalid or noticeably worse than the reference, and writes a side-by-side report to `.qa/report/index.html`.

`npm run test:e2e` needs Playwright's browsers once: `npx playwright install chromium webkit`. It converts every supported format, checks each download is a valid WebP of the right size with transparency kept, checks the ZIP, drag and drop, file limits, and that a 12-megapixel photo converts without freezing the page. Screenshots land in `.qa/screenshots/`.

## Security

- Everything runs in the browser: no server, no uploads, no analytics or cookies. A browser test (`nothing leaves the browser`) fails if the page ever sends data or contacts another site.
- `public/_headers` sets the security headers Netlify serves (a strict Content-Security-Policy, frame blocking, nosniff, no referrer). The local preview reads the same file, so the browser tests run under them.
- Image sizes are read from the file header before decoding (`src/lib/imageSize.ts`), so a tiny file claiming huge dimensions is refused without allocating memory for it.
- `netlify.toml` pins the build command, output folder and Node version.
