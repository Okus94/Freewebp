import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NotFoundPage } from './pages/NotFoundPage'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotFoundPage />
  </StrictMode>,
)
