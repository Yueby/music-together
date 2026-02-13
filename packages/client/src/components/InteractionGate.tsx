import { motion, useReducedMotion } from 'motion/react'
import { Headphones } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InteractionGateProps {
  onStart: () => void
}

export function InteractionGate({ onStart }: InteractionGateProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-10 shadow-lg"
      >
        <motion.div
          animate={prefersReducedMotion ? {} : { rotate: [0, 5, -5, 0] }}
          transition={prefersReducedMotion ? {} : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Headphones className="h-16 w-16 text-primary" />
        </motion.div>
        <h2 className="text-xl font-semibold">准备就绪</h2>
        <p className="text-sm text-muted-foreground">点击开始，与房间好友一起听歌</p>
        <Button
          size="lg"
          onClick={onStart}
          aria-label="开始收听"
        >
          开始收听
        </Button>
      </motion.div>
    </div>
  )
}
