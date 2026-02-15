import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { MusicSource } from '@music-together/shared'
import { useState } from 'react'

const PLATFORM_LABELS: Record<MusicSource, string> = {
  netease: '网易云音乐',
  tencent: 'QQ 音乐',
  kugou: '酷狗音乐',
}

interface ManualCookieDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: MusicSource
  onSubmit: (cookie: string) => void
}

export function ManualCookieDialog({
  open,
  onOpenChange,
  platform,
  onSubmit,
}: ManualCookieDialogProps) {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>手动输入 Cookie — {PLATFORM_LABELS[platform]}</DialogTitle>
          <DialogDescription>
            从浏览器中复制 Cookie 并粘贴到下方。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <textarea
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-32 w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
            placeholder="粘贴 Cookie 字符串..."
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
          />

          <div className="text-muted-foreground space-y-1.5 text-xs">
            <p className="font-medium">如何获取 Cookie：</p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>
                打开{PLATFORM_LABELS[platform]}网页版并登录
              </li>
              <li>
                按 <kbd className="bg-muted rounded px-1 py-0.5 text-xs">F12</kbd> 打开开发者工具
              </li>
              <li>
                切换到 <kbd className="bg-muted rounded px-1 py-0.5 text-xs">Application</kbd>{' '}
                (应用) 标签
              </li>
              <li>
                在左侧找到 <kbd className="bg-muted rounded px-1 py-0.5 text-xs">Cookies</kbd>，复制所有 Cookie
              </li>
            </ol>
            <p className="mt-2 text-yellow-500">
              Cookie 仅存储在服务端内存，不会持久化保存。服务端重启后需重新登录。
            </p>
          </div>
        </div>

        <DialogFooter>
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
