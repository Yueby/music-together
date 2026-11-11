import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RotateCcw } from 'lucide-react'

export function SettingRow({
  label,
  description,
  value,
  onReset,
  children,
}: {
  label: string
  /** 设置项的说明，显示在标签下方；每个设置项都应带一条 */
  description?: string
  /** 滑块等控件的当前取值读数，显示在控件左侧 */
  value?: string
  /** 传入时显示重置按钮，点击触发回调 */
  onReset?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
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
