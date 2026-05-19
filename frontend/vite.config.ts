import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('highlight.js') || id.includes('markdown-it')) {
            return 'markdown-vendor'
          }

          if (id.includes('element-plus') || id.includes('@element-plus') || id.includes('@floating-ui')) {
            return 'element-plus-vendor'
          }

          if (id.includes('vue')) {
            return 'vue-vendor'
          }
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
