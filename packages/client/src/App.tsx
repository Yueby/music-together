import { TooltipProvider } from '@/components/ui/tooltip'
import HomePage from '@/pages/HomePage'
import RoomPage from '@/pages/RoomPage'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </BrowserRouter>
  )
}
