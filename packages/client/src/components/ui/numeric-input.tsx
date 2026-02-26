import { Input } from '@/components/ui/input'
import { useEffect, useState } from 'react'

/**
 * 数值输入组件：使用本地 state 让用户自由输入，
 * 仅在失焦或按回车时校验范围并提交。
 */
export function NumericInput({
  value,
  onChange,
  min = 10,
  max = 200,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  const [local, setLocal] = useState(String(value))

  // 外部值变化时同步（例如重置设置）
  useEffect(() => {
    setLocal(String(value))
  }, [value])

  const commit = () => {
    const v = parseInt(local, 10)
    if (Number.isFinite(v)) {
      const clamped = Math.max(min, Math.min(max, v))
      onChange(clamped)
      setLocal(String(clamped))
    } else {
      setLocal(String(value)) // 无效输入回退
    }
  }

  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
      className="w-20 text-center"
    />
  )
}
