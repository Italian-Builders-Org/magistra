import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { App } from './App'
import './app.css'
import { TooltipProvider } from '@magistra/ui/components/tooltip'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemento #root non trovato nel documento')
}

createRoot(rootElement).render(
  <StrictMode>
    <HashRouter>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </HashRouter>
  </StrictMode>
)
