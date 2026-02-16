import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { MusicSource } from '@music-together/shared'
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react'
import { useEffect, useRef } from 'react'

const PLATFORM_LABELS: Record<MusicSource, string> = {
  netease: '网易云音乐',
  tencent: 'QQ 音乐',
  kugou: '酷狗音乐',
}

interface QrLoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: MusicSource
  qrData: { key: string; qrimg: string } | null
  qrStatus: { status: number; message: string } | null
  isLoading: boolean
  onRefresh: () => void
  onCheckStatus: (key: string) => void
}

export function QrLoginDialog({
  open,
  onOpenChange,
  platform,
  qrData,
  qrStatus,
  isLoading,
  onRefresh,
  onCheckStatus,
}: QrLoginDialogProps) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const label = PLATFORM_LABELS[platform] ?? platform

  // Auto-poll QR status every 2 seconds when dialog is open and QR is generated
  useEffect(() => {
    if (!open || !qrData?.key) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    // Start polling
    pollRef.current = setInterval(() => {
      onCheckStatus(qrData.key)
    }, 2000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [open, qrData?.key, onCheckStatus])

  // On success (803) or expiry (800): stop polling immediately + auto-close on success
  useEffect(() => {
    const status = qrStatus?.status
    if (status === 800 || status === 803) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    if (status === 803) {
      const t = setTimeout(() => onOpenChange(false), 1000)
      return () => clearTimeout(t)
    }
  }, [qrStatus?.status, onOpenChange])

  const statusCode = qrStatus?.status ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{label}扫码登录</DialogTitle>
          <DialogDescription>
            使用{label} App 扫描二维码登录
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* QR Code */}
          <div className="relative flex h-52 w-52 items-center justify-center rounded-lg border bg-white">
            {isLoading && (
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            )}
            {!isLoading && qrData?.qrimg && (
              <>
                <img
                  src={qrData.qrimg}
                  alt={`${label}登录二维码`}
                  className="h-full w-full rounded-lg object-contain p-2"
                />
                {/* Overlay for expired/success */}
                {statusCode === 800 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/60">
                    <AlertCircle className="mb-2 h-8 w-8 text-white" />
                    <p className="text-sm text-white">二维码已过期</p>
                  </div>
                )}
                {statusCode === 803 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-green-600/80">
                    <CheckCircle2 className="mb-2 h-8 w-8 text-white" />
                    <p className="text-sm text-white">登录成功</p>
                  </div>
                )}
              </>
            )}
            {!isLoading && !qrData && (
              <p className="text-muted-foreground text-sm">生成二维码失败</p>
            )}
          </div>

          {/* Status message */}
          <div className="flex items-center gap-2 text-sm">
            {statusCode === 801 && (
              <>
                <Smartphone className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">打开{label} App 扫码</span>
              </>
            )}
            {statusCode === 802 && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-blue-600">已扫码，请在手机上确认</span>
              </>
            )}
            {statusCode === 803 && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-green-600">登录成功！</span>
              </>
            )}
            {statusCode === 800 && (
              <>
                <AlertCircle className="text-destructive h-4 w-4" />
                <span className="text-destructive">二维码已过期</span>
              </>
            )}
          </div>

          {/* Refresh button */}
          {(statusCode === 800 || (!qrData && !isLoading)) && (
            <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              重新获取二维码
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
