const requiredClasses = ['flex', 'grid', 'items-center', 'inline-flex', 'px-4', 'text-sm'] as const

/** Packaging gate for the shared React interface's generated Tailwind utility layer. */
export function verifyClientStyles(input: Uint8Array | string): void {
  const css = (typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: true }).decode(input))
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const selectorsPresent = requiredClasses.every((name) => new RegExp('\\.' + name + '(?=[\\s,{])').test(css))
  if (!selectorsPresent || !/\.flex[^{]*\{[^}]*display\s*:\s*flex/.test(css) ||
      !/\.grid[^{]*\{[^}]*display\s*:\s*grid/.test(css)) {
    throw new Error('CLIENT_STYLES_INCOMPLETE')
  }
}
