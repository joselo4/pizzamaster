import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installGlobalErrorHandler } from './lib/logger'




// Sentry (real) por ENV. Solo se inicializa si existe VITE_SENTRY_DSN.
const __dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (__dsn) {
  import('@sentry/react')
    .then((Sentry: any) => {
      try { (window as any).Sentry = Sentry; } catch {}
      try {
        Sentry.init({
          dsn: __dsn,
          environment: import.meta.env.MODE,
          tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
        });
      } catch {}
    })
    .catch(() => {});
}

installGlobalErrorHandler();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
