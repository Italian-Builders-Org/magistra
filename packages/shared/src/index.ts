import { z } from 'zod'

// Pacchetto dei contratti condivisi.
//
// Qui vivono i tipi e gli schemi Zod usati ai confini tra i contesti (messaggi
// IPC, input dell'utente, dati esterni), cosi frontend, backend e worker
// parlano la stessa lingua senza duplicare le definizioni. Gli schemi Zod sono
// la fonte di verita sia dei tipi TypeScript sia della validazione a runtime.
//
// E un unico modulo senza import relativi: cosi resta caricabile tanto dai
// bundler (Vite/electron-vite) quanto direttamente da Node nei test, senza
// dipendere dalla risoluzione delle estensioni.

// === Informazioni sull'app ===================================================

/** Schema Zod delle informazioni di base sull'applicazione. */
export const appInfoSchema = z.object({
  name: z.string(),
  version: z.string()
})

/** Informazioni di base sull'applicazione, validate ai confini. */
export type AppInfo = z.infer<typeof appInfoSchema>

// === Contratto delle operazioni ==============================================
//
// E la superficie che la UI puo invocare (chat, retrieval, ricerca, upload) e
// che il core di orchestrazione implementa. Per ogni operazione: un nome, uno
// schema della richiesta e uno della risposta.
//
// Stato: l'operazione «echo» e implementata come esempio end-to-end del
// pattern; chat, retrieval, ricerca e upload sono contratti gia tipizzati, la
// cui logica arriva nei task dedicati (il core risponde NOT_IMPLEMENTED).

/** Richiesta dell'operazione di esempio: un messaggio da rimbalzare. */
export const echoRequestSchema = z.object({
  message: z.string()
})

/** Risposta dell'operazione di esempio: il messaggio rimbalzato dal core. */
export const echoResponseSchema = z.object({
  message: z.string()
})

/** Richiesta di un turno di chat con l'assistente. */
export const chatRequestSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string()
})

/** Risposta di un turno di chat. */
export const chatResponseSchema = z.object({
  conversationId: z.string(),
  reply: z.string()
})

/** Richiesta di retrieval dei chunk piu rilevanti per una query. */
export const retrievalRequestSchema = z.object({
  query: z.string(),
  topK: z.number().int().positive().optional()
})

/** Chunk recuperato dall'indice, con il punteggio di rilevanza. */
export const retrievedChunkSchema = z.object({
  id: z.string(),
  text: z.string(),
  score: z.number()
})

/** Risposta di retrieval: i chunk ordinati per rilevanza. */
export const retrievalResponseSchema = z.object({
  chunks: z.array(retrievedChunkSchema)
})

/** Richiesta di ricerca nel corpus normativo. */
export const searchRequestSchema = z.object({
  query: z.string()
})

/** Singolo risultato di ricerca. */
export const searchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  snippet: z.string()
})

/** Risposta di ricerca: l'elenco dei risultati. */
export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema)
})

/** Richiesta di upload di un documento dell'utente. */
export const uploadRequestSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative()
})

/** Risposta di upload: l'identificativo del documento acquisito. */
export const uploadResponseSchema = z.object({
  documentId: z.string()
})

/**
 * Registro di tutte le operazioni: nome -> { request, response }.
 * `as const` preserva i tipi letterali, cosi da derivare da qui i tipi delle
 * richieste e delle risposte di ogni singola operazione.
 */
export const operationContracts = {
  echo: { request: echoRequestSchema, response: echoResponseSchema },
  chat: { request: chatRequestSchema, response: chatResponseSchema },
  retrieval: { request: retrievalRequestSchema, response: retrievalResponseSchema },
  search: { request: searchRequestSchema, response: searchResponseSchema },
  upload: { request: uploadRequestSchema, response: uploadResponseSchema }
} as const

/** Nome di una delle operazioni del contratto. */
export type OperationName = keyof typeof operationContracts

/** Schema Zod che accetta solo i nomi di operazione validi. */
export const operationNameSchema = z.enum(
  Object.keys(operationContracts) as [OperationName, ...OperationName[]]
)

/** Tipo della richiesta dell'operazione `K`, derivato dal suo schema. */
export type OperationRequest<K extends OperationName> = z.infer<
  (typeof operationContracts)[K]['request']
>

/** Tipo della risposta dell'operazione `K`, derivato dal suo schema. */
export type OperationResponse<K extends OperationName> = z.infer<
  (typeof operationContracts)[K]['response']
>

export type EchoRequest = OperationRequest<'echo'>
export type EchoResponse = OperationResponse<'echo'>
export type ChatRequest = OperationRequest<'chat'>
export type ChatResponse = OperationResponse<'chat'>
export type RetrievalRequest = OperationRequest<'retrieval'>
export type RetrievalResponse = OperationResponse<'retrieval'>
export type SearchRequest = OperationRequest<'search'>
export type SearchResponse = OperationResponse<'search'>
export type UploadRequest = OperationRequest<'upload'>
export type UploadResponse = OperationResponse<'upload'>

// === Confine dei messaggi (IPC) ==============================================
//
// Il trasporto reale (IPC di Electron) e solo un adattatore: qui si definisce
// il formato dei messaggi in modo indipendente da esso. Un solo canale
// trasporta tutte le operazioni; il payload viaggia come `unknown` e viene
// validato dal core con lo schema della singola operazione.

/** Nome del canale IPC unico su cui viaggiano tutte le invocazioni. */
export const IPC_INVOKE_CHANNEL = 'magistra:invoke'

/** Codici di errore stabili restituiti ai confini. */
export const operationErrorCodeSchema = z.enum([
  'INVALID_REQUEST',
  'INVALID_RESPONSE',
  'UNKNOWN_OPERATION',
  'NOT_IMPLEMENTED',
  'INTERNAL'
])

/** Codice di errore di un'operazione. */
export type OperationErrorCode = z.infer<typeof operationErrorCodeSchema>

/**
 * Errore di dominio di un'operazione, con un codice stabile.
 * E serializzabile attraverso l'IPC tramite `toEnvelopeError`.
 */
export class OperationError extends Error {
  readonly code: OperationErrorCode

  constructor(code: OperationErrorCode, message: string) {
    super(message)
    this.name = 'OperationError'
    this.code = code
  }
}

/** Envelope della richiesta: quale operazione e con quale payload. */
export const ipcRequestSchema = z.object({
  operation: operationNameSchema,
  payload: z.unknown()
})

/** Richiesta che attraversa il confine, prima della validazione del payload. */
export type IpcRequest = z.infer<typeof ipcRequestSchema>

/** Errore serializzato che attraversa il confine. */
export const ipcErrorSchema = z.object({
  code: operationErrorCodeSchema,
  message: z.string()
})

/** Errore che attraversa il confine. */
export type IpcError = z.infer<typeof ipcErrorSchema>

/**
 * Risposta che attraversa il confine: un risultato discriminato da `ok`.
 * In caso di successo `data` e gia validato con lo schema della risposta.
 */
export type IpcResponse<T> = { ok: true; data: T } | { ok: false; error: IpcError }

/** Riduce un errore qualsiasi alla forma serializzabile dell'envelope. */
export function toEnvelopeError(error: unknown): IpcError {
  if (error instanceof OperationError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { code: 'INTERNAL', message: error.message }
  }

  return { code: 'INTERNAL', message: 'Errore sconosciuto' }
}

// === Contratto dei job batch =================================================
//
// Forma osservabile di un job batch del worker: l'avanzamento mentre gira e il
// riepilogo quando arriva in fondo. Sono forme di dato, non operazioni: la
// superficie per avviare o osservare un job dall'esterno appartiene al core di
// orchestrazione, non a questo contratto.
//
// Un job che non arriva in fondo non produce un riepilogo, fallisce: per
// questo gli stati terminali sono soltanto due.

/** Stato terminale di un job batch arrivato in fondo. */
export const jobStatoSchema = z.enum(['completato', 'completato_con_quarantena'])

/** Stato terminale di un job batch. */
export type JobStato = z.infer<typeof jobStatoSchema>

/** Metadati che identificano un job: quale e di che tipo. */
export const jobDescriptorMetaSchema = z.object({
  jobId: z.string().min(1),
  tipo: z.string().min(1)
})

/** Metadati che identificano un job. */
export type JobDescriptorMeta = z.infer<typeof jobDescriptorMetaSchema>

/**
 * Conteggi di un job. `elaborati` e la somma degli altri tre: e ridondante per
 * comodita di chi mostra un avanzamento, e l'invariante e verificata dai test.
 * `totale` e noto solo quando la sorgente degli item e finita; su una sorgente
 * in streaming resta `null`, che e piu onesto di un totale inventato.
 */
export const jobConteggiSchema = z.object({
  elaborati: z.number().int().nonnegative(),
  ok: z.number().int().nonnegative(),
  parziali: z.number().int().nonnegative(),
  inQuarantena: z.number().int().nonnegative(),
  totale: z.number().int().nonnegative().nullable()
})

/** Conteggi di un job. */
export type JobConteggi = z.infer<typeof jobConteggiSchema>

/** Avanzamento di un job in corso, emesso dopo ogni item. */
export const jobProgressSchema = jobDescriptorMetaSchema.merge(jobConteggiSchema)

/** Avanzamento di un job in corso. */
export type JobProgress = z.infer<typeof jobProgressSchema>

/** Riepilogo finale di un job arrivato in fondo. */
export const jobSummarySchema = jobProgressSchema.extend({
  stato: jobStatoSchema
})

/** Riepilogo finale di un job. */
export type JobSummary = z.infer<typeof jobSummarySchema>
