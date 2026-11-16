import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Static (non-variable) fonts: Chrome embeds variable fonts in PDFs as Type 3 fonts,
// which some ATS / resume parsers read poorly. Static fonts embed as TrueType.
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/400-italic.css'
import '@fontsource/source-sans-3/700.css'
import '@fontsource/source-sans-3/700-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/400-italic.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/700-italic.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/400-italic.css'
import '@fontsource/roboto/700.css'
import '@fontsource/roboto/700-italic.css'
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/400-italic.css'
import '@fontsource/open-sans/700.css'
import '@fontsource/open-sans/700-italic.css'
import '@fontsource/lora/400.css'
import '@fontsource/lora/400-italic.css'
import '@fontsource/lora/700.css'
import '@fontsource/lora/700-italic.css'
import './styles/app.css'
import './styles/resume.css'
import './styles/print.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
