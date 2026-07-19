import {
  OperationError,
  operationContracts,
  type OperationName,
  type OperationRequest,
  type OperationResponse
} from '@magistra/shared'

// Core di orchestrazione, indipendente dal trasporto.
//
// Espone il contratto tipizzato delle operazioni (chat, retrieval, ricerca,
// upload) in due forme:
//
//   - `operations`: i gestori tipizzati, invocabili direttamente con argomenti
//      gia validati dal tipo. E la via usata nei test e da qualsiasi chiamante
//      in-process, senza passare dall'IPC.
//   - `invoke(operation, payload)`: la via dei confini. Riceve un payload
//      `unknown`, lo valida con lo schema della richiesta, esegue il gestore e
//      valida la risposta. E cio che l'adattatore IPC collega al renderer.
//
// Il trasporto (IPC di Electron) resta un dettaglio sostituibile: qui non se ne
// sa nulla. E un unico modulo senza import relativi, cosi resta caricabile da
// Node direttamente nei test.
//
// I gestori reali di chat/retrieval/ricerca/upload riceveranno provider LLM,
// indice e storage dietro le rispettive interfacce (iniettati in `createCore`),
// cosi il core resta testabile con implementazioni di prova. Per ora non c'e
// nulla da iniettare e il factory non prende argomenti.

/** Mappa dei gestori: per ogni operazione una funzione richiesta -> risposta. */
export type OperationHandlers = {
  [K in OperationName]: (
    request: OperationRequest<K>
  ) => Promise<OperationResponse<K>> | OperationResponse<K>
}

/** Il core: i gestori tipizzati piu la via di invocazione dai confini. */
export interface Core {
  /** Gestori tipizzati, invocabili direttamente con argomenti gia validati. */
  readonly operations: OperationHandlers
  /**
   * Invoca un'operazione validando richiesta e risposta ai confini.
   * Lancia `OperationError` con codice `INVALID_REQUEST`/`INVALID_RESPONSE` se
   * la validazione fallisce.
   */
  invoke<K extends OperationName>(operation: K, payload: unknown): Promise<OperationResponse<K>>
}

/** Crea un'istanza del core. */
export function createCore(): Core {
  const handlers: OperationHandlers = {
    // Esempio implementato: rimbalza il messaggio ricevuto.
    echo: (request) => ({ message: request.message }),

    // Contratti gia tipizzati, logica nei task dedicati.
    chat: () => {
      throw new OperationError('NOT_IMPLEMENTED', "L'operazione «chat» non e ancora implementata")
    },
    retrieval: () => {
      throw new OperationError(
        'NOT_IMPLEMENTED',
        "L'operazione «retrieval» non e ancora implementata"
      )
    },
    search: () => {
      throw new OperationError(
        'NOT_IMPLEMENTED',
        "L'operazione «ricerca» non e ancora implementata"
      )
    },
    upload: () => {
      throw new OperationError('NOT_IMPLEMENTED', "L'operazione «upload» non e ancora implementata")
    }
  }

  async function invoke<K extends OperationName>(
    operation: K,
    payload: unknown
  ): Promise<OperationResponse<K>> {
    const contract = operationContracts[operation]

    const parsedRequest = contract.request.safeParse(payload)
    if (!parsedRequest.success) {
      throw new OperationError(
        'INVALID_REQUEST',
        `Richiesta non valida per «${operation}»: ${parsedRequest.error.message}`
      )
    }

    const handler = handlers[operation]
    const result = await handler(parsedRequest.data as OperationRequest<K>)

    const parsedResponse = contract.response.safeParse(result)
    if (!parsedResponse.success) {
      throw new OperationError(
        'INVALID_RESPONSE',
        `Risposta non valida per «${operation}»: ${parsedResponse.error.message}`
      )
    }

    return parsedResponse.data as OperationResponse<K>
  }

  return { operations: handlers, invoke }
}
