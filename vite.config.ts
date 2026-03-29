import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devHeaders = {
  'Content-Security-Policy': "default-src 'self' http://localhost:* ws://localhost:*; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https: http://localhost:*; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* blob:; connect-src 'self' http://localhost:* ws://localhost:* https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' data: blob: https:",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

const previewHeaders = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' data: blob: https:; frame-src 'none'; upgrade-insecure-requests",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

export default defineConfig(({ command }) => ({
  base: '/',
  plugins: [react()],
  optimizeDeps: { entries: ['index.html'] },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    headers: devHeaders,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    headers: previewHeaders,
  },
}))
