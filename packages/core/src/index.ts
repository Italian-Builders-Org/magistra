import {
  OperationError,
  descriviErroriValidazione,
  operationContracts,
  type OperationName,
  type OperationRequest,
  type OperationResponse,
  type ProviderConfigInput,
  type ProviderTestResult,
  type ProviderView
} from '@magistra/shared'

// Servizio della gestione delle API key (configurazione dei provider).
//
// E una porta: il core dichiara l'interfaccia e delega, ma non conosce ne il
// database ne il Vercel AI SDK. L'implementazione concreta (che cifra i segreti
// con il vault del SO, li conserva nello strato dati e testa la connessione con
// l'astrazione dei provider) vive nel processo main e viene iniettata in
// `createCore`. Cosi il core resta indipendente dal trasporto e leggero,
// caricabile da Node nei test senza trascinare PGlite o l'SDK LLM.
//
// I metodi possono sollevare `OperationError` con codice stabile (`NOT_FOUND`,
// `INVALID_REQUEST`), che attraversa l'IPC gia serializzato.

/** La porta della configurazione dei provider LLM, iniettata nel core. */
export interface ProviderSettingsService {
  /** Elenca i provider configurati, senza esporne i segreti. */
  list(): Promise<ProviderView[]>
  /** Crea o aggiorna la configurazione di un provider; cifra la chiave se presente. */
  save(input: ProviderConfigInput): Promise<ProviderView>
  /** Rimuove un provider e la sua chiave cifrata; `NOT_FOUND` se non esiste. */
  remove(id: string): Promise<boolean>
  /** Rende attivo un provider (al piu uno), disattivando gli altri. */
  activate(id: string): Promise<ProviderView>
  /** Testa la raggiungibilita del provider e la presenza del modello. */
  testConnection(id: string): Promise<ProviderTestResult>
}

/** Dipendenze iniettabili nel core. */
export interface CoreDeps {
  /** Servizio della gestione delle API key; assente nei test del solo contratto. */
  readonly providerSettings?: ProviderSettingsService
}

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

/**
 * Restituisce il servizio dei provider iniettato, oppure solleva
 * `NOT_IMPLEMENTED`: cosi `createCore()` senza dipendenze resta valido per i
 * test del solo contratto, mentre l'app lo cabla nel processo main.
 */
function requireProviderSettings(deps: CoreDeps): ProviderSettingsService {
  if (!deps.providerSettings) {
    throw new OperationError(
      'NOT_IMPLEMENTED',
      'La gestione delle API key non e disponibile: servizio non configurato.'
    )
  }
  return deps.providerSettings
}

/** Crea un'istanza del core, opzionalmente con le dipendenze iniettate. */
export function createCore(deps: CoreDeps = {}): Core {
  const handlers: OperationHandlers = {
    // Esempio implementato: rimbalza il messaggio ricevuto.
    echo: (request) => ({ message: request.message }),

    // Gestione delle API key: delega al servizio iniettato.
    providerList: async () => ({ providers: await requireProviderSettings(deps).list() }),
    providerSave: (request) => requireProviderSettings(deps).save(request),
    providerDelete: async (request) => ({
      deleted: await requireProviderSettings(deps).remove(request.id)
    }),
    providerActivate: (request) => requireProviderSettings(deps).activate(request.id),
    providerTest: (request) => requireProviderSettings(deps).testConnection(request.id),

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
    if (!contract) {
      // Difesa per chiamanti non tipizzati (l'adattatore IPC valida gia
      // l'operazione, ma `invoke` puo essere chiamata anche altrove).
      throw new OperationError('UNKNOWN_OPERATION', `Operazione sconosciuta: «${operation}»`)
    }

    const parsedRequest = contract.request.safeParse(payload)
    if (!parsedRequest.success) {
      throw new OperationError(
        'INVALID_REQUEST',
        `Richiesta non valida per «${operation}»: ${descriviErroriValidazione(parsedRequest.error)}`
      )
    }

    const handler = handlers[operation]
    const result = await handler(parsedRequest.data as OperationRequest<K>)

    const parsedResponse = contract.response.safeParse(result)
    if (!parsedResponse.success) {
      throw new OperationError(
        'INVALID_RESPONSE',
        `Risposta non valida per «${operation}»: ${descriviErroriValidazione(parsedResponse.error)}`
      )
    }

    return parsedResponse.data as OperationResponse<K>
  }

  return { operations: handlers, invoke }
}
