import type { MagistraApi } from './index'

// Tipizza l'API esposta dal preload sull'oggetto globale del renderer.
declare global {
  interface Window {
    magistra: MagistraApi
  }
}

export {}
