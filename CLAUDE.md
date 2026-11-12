# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, client-only website (freewebp.org) that converts images (JPG, PNG, GIF, AVIF, BMP, SVG, ICO) to WebP entirely in the browser. Nothing is uploaded anywhere: decoding uses the browser's own decoders, encoding uses libwebp compiled to WebAssembly (`@jsquash/webp`) running in a Web Worker. There is no backend, no analytics, no cookies.

## Commands

```sh
npm install
npm run dev        # local dev server (Vite)
npm test           # unit tests (Vitest), including real WebP encoding
npm run build      # tsc -b type-check, then vite build -> dist/
npm run preview    # serve the built dist/ locally
npm run qa         # quality benchmark: this site's encoder vs Google's libwebp
npm run test:e2e   # real-browser tests (Chromium + WebKit) against the production build
npm run assets     # regenerate brand assets (scripts/brand-assets.mjs)
```

Running a single unit test: `npx vitest run src/lib/files.test.ts` (or `npx vitest` for watch mode, add `-t "name"` to filter by test name).

Running a single e2e test: `npx playwright test -g "test name"`. First-time setup needs `npx playwright install chromium webkit`. E2E tests build and serve the production bundle themselves (see `playwright.config.ts`), so they're slow — don't reach for them when a unit test would do.

`dist/` is the deployable static site (works on any static host; this project deploys to Netlify — see `netlify.toml`).

## Architecture

### Conversion pipeline

The core flow spans four files and is worth understanding as a whole before touching any one of them:

1. `src/hooks/useConverter.ts` — the queue. Holds all `ConvertItem`s, validates new files (`src/lib/files.ts`: max 10 MB each, 20 files at a time, accepted type/extension list), and converts **one item at a time** (deliberate — avoids holding every decoded image in memory for large batches). Drives item lifecycle: `queued -> converting -> done | error`, plus exit-animation timing (`leaving` flag, `EXIT_MS`) before an item is actually removed from state.
2. `src/lib/convert.ts` — `convertToWebp(file)`. First reads declared dimensions from the file header via `src/lib/imageSize.ts` (cheap rejection of decompression-bomb-style files before allocating pixel memory), then decodes to `ImageData` (`createImageBitmap`, falling back to an `<img>` element for SVG and browsers that can't `createImageBitmap` an ICO), then hands the pixels to the worker. Throws `ImageProblem` for user-facing errors (bad dimensions, unreadable file) vs. unexpected errors (logged with `console.error`, shown as a generic message).
3. `src/workers/encode.worker.ts` — runs in a Web Worker; calls `@jsquash/webp/encode` at `WEBP_QUALITY` (`src/lib/settings.ts`, currently 80) and posts the encoded buffer back, transferring ownership both ways (no copies of pixel/encoded buffers across the worker boundary).
4. `src/lib/download.ts` — single-file downloads, and `zipFiles()` (via `fflate`, stored uncompressed since WebP is already compressed) for "Download all".

`src/lib/settings.ts` is intentionally import-free so both the app and the Node-based QA benchmark (`qa/benchmark.ts`) can share `WEBP_QUALITY` without pulling browser code into Node.

### Image size / decompression-bomb defense

`src/lib/imageSize.ts` hand-parses PNG, GIF, BMP, WebP, JPEG, and AVIF/ISO-BMFF headers to read width/height *without decoding pixels*. This exists specifically so a tiny file claiming huge dimensions can be rejected before canvas allocates memory for every pixel. SVG and some ICOs can't be read this way; those fall through to a second dimension check performed after decode, in `convert.ts`. Limits live in `src/lib/files.ts`: `MAX_SIDE` (16383px, WebP's own limit) and `MAX_PIXELS` (50 MP).

### Multi-page build, not an SPA

`vite.config.ts` sets `appType: 'mpa'` with three real HTML entry points (`index.html`, `privacy/index.html`, `404.html`). This is deliberate: an unknown path should produce a true 404 (served by Netlify from `404.html`) rather than silently rendering the converter. Each page has its own small entry (`src/main.tsx`, `src/privacy.tsx`, `src/notFound.tsx`) mounting `src/App.tsx`, `src/pages/PrivacyPage.tsx`, or `src/pages/NotFoundPage.tsx`.

### Security headers in dev and prod

`public/_headers` is the source of truth for Netlify's response headers (strict CSP, frame blocking, nosniff, no referrer). `vite.config.ts` parses that same file (`netlifyHeaders()`) and applies it to `vite preview`, so `npm run test:e2e` — which runs against `vite preview` — exercises the real production headers, not a looser dev config. The dev server (`npm run dev`) intentionally does *not* use these headers, since Vite's HMR needs inline scripts the CSP would block.

### Vendored UI components

`src/vendor/chromatic-button/` and `src/vendor/shape-physics/` are third-party components from ReactDrops, under a license that permits use in this site but not redistribution as a reusable component — treat them as license-locked, not as examples to copy elsewhere. Each has a README noting exactly what's used and what's been locally modified (e.g. `shape-physics`'s `solid-engine.ts` has one local patch, documented in its README, to clear the canvas before each paint since this site uses a transparent background). Don't "clean up" or refactor these beyond what a specific documented change requires — check the README before editing either folder.

### QA: encoder-quality benchmark vs. libwebp

`npm run qa` is a Node script (`qa/benchmark.ts`), not a browser test. It downloads the 24 Kodak reference photos once (cached under `.qa/corpus/`), encodes each with this site's actual encoder path (`@jsquash/webp`, the same quality constant from `src/lib/settings.ts`) and with `sharp` (which embeds the same libwebp library `cwebp` uses), then compares size, SSIM, PSNR, and speed. It fails the build if output is invalid or measurably worse than the native reference (thresholds: `MAX_SSIM_DROP`, `MAX_SIZE_RATIO`, `MAX_ALPHA_ERROR` in `qa/benchmark.ts`). A side-by-side HTML report is written to `.qa/report/index.html`. `qa/metrics.ts` implements the SSIM/PSNR/alpha-error math used by both this benchmark and the e2e tests.

### E2E tests run against the real production build

`playwright.config.ts`'s `webServer` runs `npm run build && vite preview`, i.e. e2e tests (`e2e/converter.spec.ts`) exercise the actual deployed bundle and headers, not the dev server. `e2e/global-setup.ts` generates one fixture file per supported format (plus deliberately bad ones: oversized, a PNG decompression-bomb header, wrong file type) into `.qa/fixtures/` before the suite runs; `e2e/fixtures.ts` is the shared manifest both the setup script and the spec file read from. Every test asserts zero browser console errors (`page.on('pageerror'/'console')` in `beforeEach`/`afterEach`), and one test specifically asserts the page never sends a network request anywhere ("nothing leaves the browser").

### Styling

Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js` — theme is defined inline in `src/index.css` under `@theme`, including custom colors like `--color-rose`/`--color-paper` and the `--ease-fluid` easing curve used for most transitions). Geist Variable is self-hosted via `@fontsource-variable/geist` so it works under the strict CSP (no external font CDN). Custom component classes (`.glass-field`, `.stroke-ring`, `.stroke-bulb`) live in `src/index.css` under `@layer components`; read the comments there before changing border-light or glass-panel effects — they explain non-obvious constraints (e.g. writing both `backdrop-filter` and its `-webkit-` prefix breaks Safari's autoprefixer).
