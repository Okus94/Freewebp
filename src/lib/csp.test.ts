import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const headers = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8')
const csp = headers.match(/^\s+Content-Security-Policy: (.+)$/m)![1]
const fingerprint = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`

describe('Content-Security-Policy', () => {
  it("allows Sonner's injected stylesheet by its exact fingerprint", () => {
    // Sonner injects its CSS at runtime; if an update changes it, this fails before the toasts break.
    const source = readFileSync(require.resolve('sonner').replace(/index\.js$/, 'index.mjs'), 'utf8')
    const literal = source.match(/__insertCSS\("((?:[^"\\]|\\.)*)"\)/)![1]
    const css = JSON.parse(`"${literal}"`) as string
    expect(csp).toContain(fingerprint(css))
  })

  it('stays strict: no inline scripts, no outside origins', () => {
    expect(csp).not.toContain('unsafe-inline')
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).not.toMatch(/https?:/)
    expect(csp).toContain("frame-ancestors 'none'")
  })
})
