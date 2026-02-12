import { useState } from 'react'
import { Play } from 'lucide-react'
import { isAudioUnlocked, unlockAudio } from '@/lib/audioUnlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function InteractionGate({ children }: { children: React.ReactNode }) {
  const [gateOpen, setGateOpen] = useState(() => isAudioUnlocked())

  if (gateOpen) return <>{children}</>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="flex flex-col items-center gap-4 p-8">
        <Play className="h-12 w-12 text-primary" />
        <h2 className="text-xl font-semibold">准备就绪</h2>
        <p className="text-muted-foreground">点击开始，与房间好友一起听歌</p>
        <Button
          size="lg"
          onClick={async () => {
            await unlockAudio()
            setGateOpen(true)
          }}
        >
          开始收听
        </Button>
      </Card>
    </div>
  )
}
