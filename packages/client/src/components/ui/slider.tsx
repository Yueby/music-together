import * as React from 'react'
import { Slider as SliderPrimitive } from 'radix-ui'
import { motion, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils'

interface SliderProps extends React.ComponentProps<typeof SliderPrimitive.Root> {
  /** Buffered or downloaded progress in the same `min..max` scale as `value`. */
  bufferedValue?: number
  /** Show an indeterminate loading shimmer along the track when buffered progress is unknown. */
  loading?: boolean
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  bufferedValue,
  loading = false,
  ...props
}: SliderProps) {
  const prefersReducedMotion = useReducedMotion()
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  )
  const isVertical = props.orientation === 'vertical'
  const bufferedPercent =
    typeof bufferedValue === 'number' && Number.isFinite(bufferedValue)
      ? max > min
        ? Math.max(0, Math.min(100, ((bufferedValue - min) / (max - min)) * 100))
        : 0
      : null

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'group/slider relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          'bg-white/25 relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
        )}
      >
        {bufferedPercent !== null && (
          <span
            aria-hidden="true"
            data-slot="slider-buffered"
            className={cn(
              'pointer-events-none absolute rounded-full bg-white/25 transition-[width,height] duration-200 ease-out motion-reduce:transition-none',
              isVertical ? 'inset-x-0 bottom-0' : 'inset-y-0 left-0',
            )}
            style={isVertical ? { height: `${bufferedPercent}%` } : { width: `${bufferedPercent}%` }}
          />
        )}
        {bufferedPercent === null && loading && (
          prefersReducedMotion ? (
            <span
              aria-hidden="true"
              data-slot="slider-loading"
              className="pointer-events-none absolute inset-0 bg-white/20"
            />
          ) : (
            <motion.span
              aria-hidden="true"
              data-slot="slider-loading"
              className={cn(
                'pointer-events-none absolute rounded-full',
                isVertical
                  ? 'inset-x-0 h-2/5 bg-gradient-to-t from-transparent via-white/40 to-transparent'
                  : 'inset-y-0 w-2/5 bg-gradient-to-r from-transparent via-white/40 to-transparent',
              )}
              initial={isVertical ? { y: '250%' } : { x: '-100%' }}
              animate={isVertical ? { y: ['250%', '-100%'] } : { x: ['-100%', '260%'] }}
              transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
            />
          )
        )}
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn('bg-white/70 absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full')}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="border-white/50 ring-white/20 block size-4 shrink-0 rounded-full border bg-white shadow-sm opacity-0 transition-[color,box-shadow,opacity] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden focus:opacity-100 group-hover/slider:opacity-100 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
