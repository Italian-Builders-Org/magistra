import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// electron-vite gestisce i tre contesti di Electron (main, preload, renderer)
// con un'unica configurazione e HMR in sviluppo. Il renderer è un puro bundle
// statico React: in produzione viene servito dal protocollo locale `app://`
// (vedi src/main/index.ts), senza aprire porte.
// I pacchetti di workspace (@magistra/*) sono distribuiti come sorgenti
// TypeScript, non come JS compilato: vanno bundlati da Vite in main e preload,
// non esternalizzati (Node non saprebbe importare i loro .ts a runtime).
//
// Conseguenza da tenere a mente: `externalizeDepsPlugin` esternalizza in base
// alle `dependencies` di questo package.json. Le dipendenze pesanti dei
// pacchetti bundlati (PGlite per @magistra/data, il Vercel AI SDK per
// @magistra/provider) vanno quindi dichiarate ANCHE qui, altrimenti finirebbero
// dentro il bundle di main. I range vanno tenuti allineati con quelli dei
// rispettivi pacchetti: sono la stessa dipendenza, dichiarata due volte.
const workspacePackages = [
  '@magistra/shared',
  '@magistra/core',
  '@magistra/data',
  '@magistra/provider'
]

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })]
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })]
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
