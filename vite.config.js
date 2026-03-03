import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Files in public/ are served at root: /LeopoldFC980M.glb
  build: {
    rollupOptions: {
      input: {
        main:     resolve(__dirname, 'index.html'),
        details:  resolve(__dirname, 'details.html'),
        preorder: resolve(__dirname, 'preorder.html'),
      }
    }
  },
  server: {
    open: true
  }
})
