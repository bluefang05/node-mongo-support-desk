import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'

  return {
    plugins: [react()],
    base: demo ? './' : '/',
    define: {
      __DEMO__: JSON.stringify(demo),
    },
    build: {
      outDir: demo ? '../docs' : '../public',
      emptyOutDir: true,
    },
    server: {
      port: 5174,
      proxy: {
        '/api': 'http://127.0.0.1:3000',
      },
    },
  }
})
