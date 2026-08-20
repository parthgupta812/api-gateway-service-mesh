import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In production the app is served by nginx, which proxies:
//   /api/prom/* -> $PROMETHEUS_UPSTREAM (default http://prometheus:9090)
//   /api/gw/*   -> $GATEWAY_UPSTREAM    (default http://gateway:8080)
// (see frontend/nginx.conf.template and frontend/Dockerfile). The dev
// server below is local-development-only and always targets localhost,
// so `npm run dev` works against a running docker compose stack on the
// host regardless of any VITE_*_PUBLIC_URL build-time variables, which
// only affect QuickLinks.tsx in production builds.
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
