import './browserApiStub'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import TooltipLayer from './components/TooltipLayer'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {/* Outside the boundary: tooltips keep working on its fallback screen. */}
    <TooltipLayer />
  </React.StrictMode>
)
