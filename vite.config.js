import { defineConfig } from 'vite'

export default defineConfig({
  // './' чтобы работало и на GitHub Pages, и на Vercel
  base: './',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Phaser — большая библиотека, увеличиваем лимит предупреждений
    chunkSizeWarningLimit: 3000,
  },

  server: {
    port: 3000,
    // Открывает браузер автоматически при npm run dev
    open: true,
  },
})
