/** Apple-style easing: fast launch, graceful deceleration */
export const SPRING = { type: 'spring' as const, duration: 0.5, bounce: 0.1 }

/** Shared layout transition for layoutId FLIP animations (cover-art, song-info) */
export const LAYOUT_TRANSITION = { layout: SPRING }
