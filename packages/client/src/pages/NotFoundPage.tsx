import { Button } from '@/components/ui/button'
import { Home, Music } from 'lucide-react'
import { m, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const prefersReducedMotion = useReducedMotion()

  return (
    <m.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
      className="flex min-h-[var(--app-vh)] items-center justify-center bg-background"
    >
      <m.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5 }}
        className="flex flex-col items-center gap-5 text-center"
      >
        <m.div
          animate={prefersReducedMotion ? undefined : { rotate: [0, 10, -10, 0] }}
          transition={prefersReducedMotion ? undefined : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Music className="h-16 w-16 text-muted-foreground/20 motion-reduce:animate-none" />
        </m.div>
        <h1 className="text-4xl font-bold text-muted-foreground/30 sm:text-6xl">404</h1>
        <p className="text-lg text-muted-foreground/60">页面不存在</p>
        <Button onClick={() => navigate('/', { replace: true })}>
          <Home className="mr-2 h-4 w-4" />
          返回首页
        </Button>
      </m.div>
    </m.div>
  )
}
