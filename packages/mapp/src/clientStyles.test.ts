import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('client stylesheet workspace source contract', () => {
  it('loads the Mapp wrapper and explicitly scans the shared client component directory', async () => {
    const entry = await readFile(new URL('./clientMain.ts', import.meta.url), 'utf8')
    const cssUrl = new URL('./client.css', import.meta.url)
    const css = await readFile(cssUrl, 'utf8')
    expect(entry).toContain("import './client.css'")
    expect(css).toContain("@import '../../client/src/index.css'")
    const source = /@source\s+['"]([^'"]+)['"]/.exec(css)?.[1]
    expect(source).toBe('../../client/src')
    expect(fileURLToPath(new URL(source + '/', cssUrl))).toBe(fileURLToPath(new URL('../../client/src/', cssUrl)))
    const webCss = await readFile(new URL('../../client/src/index.css', cssUrl), 'utf8')
    expect(webCss).not.toContain("@source '../../client/src'")
  })

  it('uses viewport heights on the Web and fixed heights in the Mapp iframe', async () => {
    const [webCss, mappCss] = await Promise.all([
      readFile(new URL('../../client/src/index.css', import.meta.url), 'utf8'),
      readFile(new URL('./client.css', import.meta.url), 'utf8'),
    ])

    expect(webCss).toMatch(/:root\s*\{[^}]*--app-vh:\s*100vh;/)
    expect(webCss).toMatch(/:root\s*\{[^}]*--app-dvh:\s*100dvh;/)
    expect(mappCss).toMatch(/:root\s*\{\s*--app-vh:\s*640px;\s*--app-dvh:\s*640px;\s*\}/)
    expect(mappCss).toMatch(
      /@media\s*\(min-width:\s*768px\)\s*\{\s*:root\s*\{\s*--app-vh:\s*720px;\s*--app-dvh:\s*720px;\s*\}/,
    )
    expect(mappCss).toMatch(/html\s*,\s*body\s*\{\s*margin:\s*0;\s*padding:\s*0;\s*\}/)
  })

  it('keeps raw viewport height utilities and values out of shared client code', async () => {
    const clientSrc = fileURLToPath(new URL('../../client/src/', import.meta.url))
    const files = (await readdir(clientSrc, { recursive: true })).filter(
      (file) => /\.tsx?$/.test(file) && !/\.(test|spec)\.tsx?$/.test(file),
    )
    const viewportHeight = /\b(?:h-(?:screen|[dsl]vh)|\d+(?:\.\d+)?[dsl]?vh)\b/i
    const violations = await Promise.all(
      files.map(async (file) => {
        const source = await readFile(resolve(clientSrc, file), 'utf8')
        const match = source.match(viewportHeight)
        return match ? `${file}: ${match[0]}` : null
      }),
    )

    expect(violations.filter(Boolean)).toEqual([])
  })

  // The sandbox's CSP only allows stylesheets that ship with the package. sonner injects its rules at runtime through a
  // <style> element, which that CSP blocks: toasts then appear unstyled in the bottom-left corner of the page.
  it('ships the toast styles in the stylesheet instead of relying on sonner injecting them', async () => {
    const webCss = await readFile(new URL('../../client/src/index.css', import.meta.url), 'utf8')
    expect(webCss).toMatch(/@import\s+['"]sonner\/dist\/styles\.css['"]/)
  })

  it('ships static ScrollArea and modal scroll-lock rules in the Mapp stylesheet', async () => {
    const css = await readFile(new URL('./client.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\[data-radix-scroll-area-viewport\]\s*\{\s*scrollbar-width: none;\s*-ms-overflow-style: none;\s*-webkit-overflow-scrolling: touch;\s*\}/)
    expect(css).toMatch(/\[data-radix-scroll-area-viewport\]::-webkit-scrollbar\s*\{\s*display: none;\s*\}/)
    expect(css).toMatch(/\[data-radix-scroll-area-viewport\]\s*>\s*div\s*\{\s*min-width: 100%;\s*display: table;\s*\}/)
    expect(css).toMatch(/body\[data-scroll-locked\]\s*\{\s*overflow: hidden !important;\s*overscroll-behavior: contain;\s*\}/)
  })
})
