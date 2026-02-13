import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { storage } from '@/lib/storage'
import { useState } from 'react'
import { toast } from 'sonner'
import { SettingRow } from './SettingRow'

export function ProfileSettingsSection() {
  const [nickname, setNickname] = useState(storage.getNickname())

  const handleNicknameBlur = () => {
    const trimmed = nickname.trim()
    if (trimmed) {
      storage.setNickname(trimmed)
      toast.success('昵称已保存（下次加入房间生效）')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">个人信息</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="昵称" description="修改后下次加入房间生效">
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onBlur={handleNicknameBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleNicknameBlur()}
            className="w-40"
            placeholder="输入昵称..."
          />
        </SettingRow>
      </div>
    </div>
  )
}
