import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DIALOG_BAR_CLASS, DIALOG_BODY_CLASS } from '@/components/ui/responsive-dialog'
import { Textarea } from '@/components/ui/textarea'
import { PLATFORM_LABELS } from '@/lib/platform'
import { cn } from '@/lib/utils'
import type { MusicSource } from '@music-together/shared'
import { useState } from 'react'

interface ManualCookieDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: MusicSource
  onSubmit: (cookie: string) => void
}

export function ManualCookieDialog({ open, onOpenChange, platform, onSubmit }: ManualCookieDialogProps) {
  const [cookie, setCookie] = useState('')

  const handleSubmit = () => {
    const trimmed = cookie.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setCookie('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setCookie('')
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className={DIALOG_BAR_CLASS}>
          <DialogTitle className="truncate">手动输入 Cookie — {PLATFORM_LABELS[platform]}</DialogTitle>
        </DialogHeader>

        <div className={cn(DIALOG_BODY_CLASS, 'space-y-3')}>
          <DialogDescription>从浏览器中复制 Cookie 并粘贴到下方。</DialogDescription>
          <Textarea
            className="h-32 resize-none"
            placeholder="粘贴 Cookie 字符串..."
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
          />

          <div className="text-muted-foreground space-y-1.5 text-xs">
            <p className="font-medium">如何获取 Cookie：</p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>打开{PLATFORM_LABELS[platform]}网页版并登录</li>
              <li>
                按 <kbd className="bg-muted rounded px-1 py-0.5 text-xs">F12</kbd> 打开开发者工具
              </li>
              <li>
                切换到 <kbd className="bg-muted rounded px-1 py-0.5 text-xs">Application</kbd> (应用) 标签
              </li>
              <li>
                在左侧找到 <kbd className="bg-muted rounded px-1 py-0.5 text-xs">Cookies</kbd>，复制所有 Cookie
              </li>
            </ol>
            <p className="mt-2 text-yellow-500">Cookie 仅存储在服务端内存，不会持久化保存。服务端重启后需重新登录。</p>
          </div>
        </div>

        <DialogFooter className="px-4 pb-4 sm:px-6 sm:pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!cookie.trim()}>
            提交验证
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
