import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Info, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export function SettingRow({
  label,
  description,
  value,
  onReset,
  children,
}: {
  label: string
  /** 设置项的说明：不占版面，以标签旁的提示图标 + tooltip 呈现（触屏点按图标即可查看） */
  description?: string
  /** 滑块等控件的当前取值读数，显示在控件左侧 */
  value?: string
  /** 传入时显示重置按钮，点击触发回调 */
  onReset?: () => void
  children: React.ReactNode
}) {
  const [hintOpen, setHintOpen] = useState(false)

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-1">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          // Radix 的 Tooltip 在按下触发器时会立刻关闭，触屏没有 hover，点按就等于"按下"，
          // 所以受控并在 click 时显式打开，手机上点图标才看得到说明
          <Tooltip delayDuration={150} open={hintOpen} onOpenChange={setHintOpen}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setHintOpen(true)}
                aria-label={description}
                className="-m-1.5 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 text-pretty">{description}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onReset && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onReset}
                aria-label="恢复默认"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>恢复默认</TooltipContent>
          </Tooltip>
        )}
        {value && <span className="min-w-10 text-right text-xs tabular-nums text-muted-foreground">{value}</span>}
        {children}
      </div>
    </div>
  )
}
