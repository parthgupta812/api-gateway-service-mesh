import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In production the app is served by nginx, which proxies:
//   /api/prom/* -> prometheus:9090
//   /api/gw/*   -> gateway:8080
// The dev server mirrors that so `npm run dev` works against a running
// docker compose stack on the host.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/prom': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/prom/, ''),
      },
      '/api/gw': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/gw/, ''),
      },
    },
  },
})
