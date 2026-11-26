/**
 * Re-exports Motion's `domMax` feature bundle as a dynamically importable module.
 * Imported via `() => import('@/lib/motionFeatures').then((mod) => mod.default)` inside `<LazyMotion>`
 * so Rolldown splits `domMax` into an async chunk in the Web SPA (and inlines it cleanly in `mapp`).
 */
export { domMax as default } from 'motion/react'
