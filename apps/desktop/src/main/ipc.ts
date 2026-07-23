import { ipcMain } from 'electron'

import type { Core } from '@magistra/core'
import {
  IPC_INVOKE_CHANNEL,
  descriviErroriValidazione,
  ipcRequestSchema,
  toEnvelopeError,
  type IpcResponse
} from '@magistra/shared'

// Adattatore IPC: il ponte sottile tra il renderer e il core.
//
// Non contiene logica di dominio. Riceve un envelope, lo valida, delega al core
// (che valida a sua volta il payload della singola operazione) e restituisce un
// risultato discriminato da `ok`, cosi il renderer distingue successo ed errore
// senza che un'eccezione attraversi il confine in forma opaca.

/**
 * Collega il core al canale IPC unico. Un solo handler serve tutte le
 * operazioni; il payload viene validato dal core con lo schema della richiesta.
 */
export function registerCoreIpc(core: Core): void {
  ipcMain.handle(IPC_INVOKE_CHANNEL, async (_event, rawRequest): Promise<IpcResponse<unknown>> => {
    const parsed = ipcRequestSchema.safeParse(rawRequest)
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: descriviErroriValidazione(parsed.error) }
      }
    }

    try {
      const data = await core.invoke(parsed.data.operation, parsed.data.payload)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: toEnvelopeError(error) }
    }
  })
}
