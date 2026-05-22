import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.GATEWAY_PORT || 33721}`,
        changeOrigin: true,
      },
      '/auth': {
        target: `http://127.0.0.1:${process.env.GATEWAY_PORT || 33721}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `http://127.0.0.1:${process.env.GATEWAY_PORT || 33721}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**'],
  },
})
