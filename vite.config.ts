import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import removeConsole from 'vite-plugin-remove-console'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Remove console.log, console.info, console.debug in production builds
    // Keeps console.error and console.warn for debugging
    removeConsole({
      includes: ['log', 'info', 'debug'],
    }),
  ],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: 'es2015',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          chess: ['chess.js', 'react-chessboard'],
          charts: ['recharts'],
          utils: ['zod'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'chess.js', 'react-chessboard', 'recharts', 'zod'],
  },
})
