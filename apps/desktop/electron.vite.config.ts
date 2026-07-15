import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// electron-vite gestisce i tre contesti di Electron (main, preload, renderer)
// con un'unica configurazione e HMR in sviluppo. Il renderer è un puro bundle
// statico React: in produzione viene servito dal protocollo locale `app://`
// (vedi src/main/index.ts), senza aprire porte.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('../../packages/ui/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
