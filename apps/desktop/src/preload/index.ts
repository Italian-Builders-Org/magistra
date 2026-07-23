import { contextBridge, ipcRenderer } from 'electron'

import {
  IPC_INVOKE_CHANNEL,
  type IpcResponse,
  type OperationName,
  type OperationRequest,
  type OperationResponse
} from '@magistra/shared'

// Ponte sicuro tra renderer e main. Con contextIsolation attivo, il renderer
// non ha accesso diretto a Node/Electron: espone solo cio che dichiariamo qui.
//
// Qui vive il client tipizzato dell'orchestrazione: `invoke` inoltra qualsiasi
// operazione sul canale IPC unico e riporta la risposta gia validata dal core,
// rilanciando come eccezione l'eventuale errore serializzato. I metodi di
// comodita (echo, chat, ...) sono scorciatoie tipizzate su `invoke`.

async function invoke<K extends OperationName>(
  operation: K,
  payload: OperationRequest<K>
): Promise<OperationResponse<K>> {
  const response: IpcResponse<OperationResponse<K>> = await ipcRenderer.invoke(IPC_INVOKE_CHANNEL, {
    operation,
    payload
  })

  if (!response.ok) {
    // Ricostruiamo l'errore lato renderer conservando il codice stabile sia in
    // `name` sia in `code`, cosi da poterlo discriminare come su `OperationError`.
    const error = new Error(response.error.message)
    error.name = response.error.code
    ;(error as { code?: string }).code = response.error.code
    throw error
  }

  return response.data
}

const api = {
  invoke,
  echo: (payload: OperationRequest<'echo'>) => invoke('echo', payload),
  chat: (payload: OperationRequest<'chat'>) => invoke('chat', payload),
  retrieval: (payload: OperationRequest<'retrieval'>) => invoke('retrieval', payload),
  search: (payload: OperationRequest<'search'>) => invoke('search', payload),
  upload: (payload: OperationRequest<'upload'>) => invoke('upload', payload),
  // Gestione delle API key (configurazione dei provider).
  providerList: (payload: OperationRequest<'providerList'>) => invoke('providerList', payload),
  providerSave: (payload: OperationRequest<'providerSave'>) => invoke('providerSave', payload),
  providerDelete: (payload: OperationRequest<'providerDelete'>) =>
    invoke('providerDelete', payload),
  providerActivate: (payload: OperationRequest<'providerActivate'>) =>
    invoke('providerActivate', payload),
  providerTest: (payload: OperationRequest<'providerTest'>) => invoke('providerTest', payload)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('magistra', api)
  } catch (error) {
    console.error(error)
  }
}

export type MagistraApi = typeof api
