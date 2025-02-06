import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import fs from 'fs-extra'

const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf-8'))

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        dev: process.env.NODE_ENV !== 'production'
      }
    }),
    crx({ manifest })
  ],
  build: {
    watch: process.env.NODE_ENV === 'development' ? {} : null,
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]'
      }
    }
  },
  server: {
    port: 5173,
    hmr: {
      port: 3000
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
}) 