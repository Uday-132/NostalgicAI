import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-chat',
    rollupOptions: {
      input: {
        chat: path.resolve(__dirname, 'chat.html')
      }
    }
  },
  server: {
    port: 3001
  }
})