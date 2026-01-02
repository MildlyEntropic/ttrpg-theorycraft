import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    // Generate sourcemaps for debugging
    sourcemap: false,
    // Optimize chunk sizes
    rollupOptions: {
      output: {
        manualChunks: {
          'spell-data': ['./src/lib/data.js', './src/lib/spell-analyzer.js'],
          'calculator': ['./src/lib/calculator.js', './src/lib/dice.js'],
        }
      }
    }
  },
  // Base path for deployment (update if deploying to subdirectory)
  base: '/',
});
