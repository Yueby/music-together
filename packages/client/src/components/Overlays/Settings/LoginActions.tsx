import { Button } from '@/components/ui/button'
import { KeyRound, ScanLine } from 'lucide-react'

interface LoginActionsProps {
  onQrLogin: () => void
  onCookieLogin: () => void
  className?: string
}

/** The two ways to sign in to a music platform: scan a QR code, or paste a cookie. */
export function LoginActions({ onQrLogin, onCookieLogin, className }: LoginActionsProps) {
  return (
    <div className={className}>
      <Button className="min-h-11 gap-2 sm:min-h-9" onClick={onQrLogin}>
        <ScanLine className="h-4 w-4" />
        扫码登录
      </Button>
      <Button variant="outline" className="min-h-11 gap-2 sm:min-h-9" onClick={onCookieLogin}>
        <KeyRound className="h-4 w-4" />
        Cookie 登录
      </Button>
    </div>
  )
}
