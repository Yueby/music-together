import { useState } from 'react'
import { motion } from 'motion/react'
import { Headphones } from 'lucide-react'
import { isAudioUnlocked, unlockAudio } from '@/lib/audioUnlock'
import { Button } from '@/components/ui/button'

export function InteractionGate({ children }: { children: React.ReactNode }) {
  const [gateOpen, setGateOpen] = useState(() => isAudioUnlocked())

  if (gateOpen) return <>{children}</>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-10 shadow-lg"
      >
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Headphones className="h-16 w-16 text-primary" />
        </motion.div>
        <h2 className="text-xl font-semibold">准备就绪</h2>
        <p className="text-sm text-muted-foreground">点击开始，与房间好友一起听歌</p>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            size="lg"
            onClick={async () => {
              await unlockAudio()
              setGateOpen(true)
            }}
          >
            开始收听
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
