import { motion } from 'motion/react'

export function HeroSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-8 text-center"
    >
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        和朋友一起听歌
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        创建或加入一个房间，实时同步音乐播放
      </p>
    </motion.div>
  )
}
