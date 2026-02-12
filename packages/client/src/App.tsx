import { TooltipProvider } from '@/components/ui/tooltip'
import { SocketProvider } from '@/providers/SocketProvider'
import HomePage from '@/pages/HomePage'
import RoomPage from '@/pages/RoomPage'
import NotFoundPage from '@/pages/NotFoundPage'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

export default function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <TooltipProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/room/:roomId" element={<RoomPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </SocketProvider>
    </BrowserRouter>
  )
}
