import { Button } from '@/components/ui/button'
import { Home, Music } from 'lucide-react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-5 text-center"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Music className="h-16 w-16 text-muted-foreground/20" />
        </motion.div>
        <h1 className="text-4xl font-bold text-muted-foreground/30 sm:text-6xl">404</h1>
        <p className="text-lg text-muted-foreground/60">页面不存在</p>
        <Button
          onClick={() => navigate('/', { replace: true })}
        >
          <Home className="mr-2 h-4 w-4" />
          返回首页
        </Button>
      </motion.div>
    </motion.div>
  )
}
