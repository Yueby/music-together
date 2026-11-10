import { readFile } from 'node:fs/promises'
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
})
