import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // KaTeX cukup besar dan jarang berubah: pisahkan agar cache-nya awet.
        manualChunks: {
          katex: ['katex'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
