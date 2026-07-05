import { contextBridge } from 'electron'

// Ponte sicuro tra renderer e main. Con contextIsolation attivo, il renderer
// non ha accesso diretto a Node/Electron: espone solo ciò che dichiariamo qui.
// Il contratto IPC tipizzato del backend (chat, retrieval, ricerca, upload)
// arriva nel task del core; per ora il ponte è vuoto ma già in posizione.
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('magistra', api)
  } catch (error) {
    console.error(error)
  }
}

export type MagistraApi = typeof api
