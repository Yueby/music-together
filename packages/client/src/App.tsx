import { TooltipProvider } from '@/components/ui/tooltip'
import { SocketProvider } from '@/providers/SocketProvider'
import HomePage from '@/pages/HomePage'
import RoomPage from '@/pages/RoomPage'
import NotFoundPage from '@/pages/NotFoundPage'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AnimatePresence } from 'motion/react'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <TooltipProvider>
          <AnimatedRoutes />
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </SocketProvider>
    </BrowserRouter>
  )
}
