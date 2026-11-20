import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { PrivacyScreen } from '@capacitor-community/privacy-screen'
import { App } from '@/app/App'
import { initTheme } from '@/lib/theme'
import '@/styles/index.css'

initTheme()

if (Capacitor.isNativePlatform()) {
  // Blur the app in the task switcher: journal entries and check-ins are
  // deeply personal and should never show in a screenshot of recent apps.
  void PrivacyScreen.enable().catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
