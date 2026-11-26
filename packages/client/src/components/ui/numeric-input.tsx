import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEffect, useState, type KeyboardEvent } from 'react'

/**
 * 数值输入组件：使用本地 state 让用户自由输入，
 * 仅在失焦或按回车时校验范围并提交。
 */
export function NumericInput({
  value,
  onChange,
  min = 10,
  max = 200,
  step,
  disabled,
  suffix,
  className,
  'aria-label': ariaLabel,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  suffix?: string
  className?: string
  'aria-label'?: string
}) {
  const [local, setLocal] = useState(String(value))

  // 外部值变化时同步（例如重置设置或拖动滑块）
  useEffect(() => {
    setLocal(String(value))
  }, [value])

  const commit = () => {
    const trimmed = local.trim()
    const parsed = trimmed === '' ? Number.NaN : Number(trimmed)
    if (Number.isFinite(parsed)) {
      const rounded = Math.round(parsed) || 0
      const clamped = Math.max(min, Math.min(max, rounded))
      onChange(clamped)
      setLocal(String(clamped))
    } else {
      setLocal(String(value)) // 无效输入回退
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit()
    } else if (e.key === 'Escape') {
      setLocal(String(value))
      e.currentTarget.blur()
    }
  }

  if (suffix) {
    return (
      <div className="relative flex items-center">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={local}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-24 pr-8 text-right font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            className,
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute right-2.5 text-xs text-muted-foreground select-none',
            disabled && 'opacity-50',
          )}
        >
          {suffix}
        </span>
      </div>
    )
  }

  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      value={local}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={cn('w-20 text-center', className)}
    />
  )
}
