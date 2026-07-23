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

// === Gestione delle API key (configurazione dei provider) ====================
//
// Contratti della configurazione locale dei provider LLM: l'utente porta la
// propria chiave, con separazione netta tra il segreto (cifrato a riposo, mai
// restituito) e la configurazione non segreta (provider, base URL, id modello,
// timeout, modalita privacy) conservata nel database applicativo.
//
// Questi schemi sono DTO indipendenti dal Vercel AI SDK: riecheggiano la forma
// di `@magistra/provider` ma vivono qui, cosi il renderer e il preload non
// trascinano l'SDK nel bundle. Il processo main mappa il DTO sulla
// configurazione concreta del provider per il test di connessione.

/**
 * Provider supportati. Riecheggia `providerKindSchema` di `@magistra/provider`;
 * `openai-compatible` copre i gateway remoti e i runtime self-hosted (Ollama,
 * LM Studio, llama.cpp), dove la chiave e opzionale e la `base_url` obbligatoria.
 */
export const providerKindSchema = z.enum(['anthropic', 'google', 'openai', 'openai-compatible'], {
  errorMap: () => ({ message: 'Tipo di provider non riconosciuto' })
})

/** Tipo di provider. */
export type ProviderKind = z.infer<typeof providerKindSchema>

/**
 * Modalita privacy: quanto contesto e lecito inviare al provider. E
 * configurazione non segreta; il valore di default e `standard`.
 */
export const modalitaPrivacySchema = z.enum(['standard', 'rigorosa'], {
  errorMap: () => ({ message: 'Modalita privacy non riconosciuta' })
})

/** Modalita privacy configurata per un provider. */
export type ModalitaPrivacy = z.infer<typeof modalitaPrivacySchema>

// I messaggi di validazione sono in italiano perche finiscono sotto gli occhi
// dell'utente: quelli predefiniti di Zod sono in inglese.

const NOME_TROPPO_LUNGO = 'Il nome e troppo lungo (massimo 120 caratteri)'
const MODELLO_TROPPO_LUNGO = "L'id del modello e troppo lungo (massimo 200 caratteri)"

/**
 * Nome di header HTTP valido (il «token» della RFC 9110). Vietare tutto il
 * resto chiude la porta all'iniezione di header via CR/LF e intercetta subito
 * un nome digitato male, invece di lasciarlo fallire nel fetch del provider.
 */
const nomeHeaderSchema = z
  .string()
  .trim()
  .min(1, "Il nome dell'header non puo essere vuoto")
  .max(200, "Il nome dell'header e troppo lungo (massimo 200 caratteri)")
  .regex(/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/, 'Nome di header HTTP non valido')

/** Valore di un header: qualsiasi testo, purche su una riga sola. */
const valoreHeaderSchema = z
  .string()
  .max(4096, "Il valore dell'header e troppo lungo (massimo 4096 caratteri)")
  .regex(/^[^\r\n]*$/, 'Il valore di un header non puo contenere un a capo')

/** Esito del test di connessione a un provider, come mostrato in UI. */
export const statoConnessioneSchema = z.enum(['ok', 'non_raggiungibile', 'modello_mancante'])

/** Stato di raggiungibilita di un provider. */
export type StatoConnessione = z.infer<typeof statoConnessioneSchema>

/**
 * Dati per creare o aggiornare la configurazione di un provider.
 * `id` presente => aggiornamento; assente => creazione. `apiKey` e il segreto in
 * chiaro: presente solo quando l'utente lo inserisce o lo cambia, non viene mai
 * restituito. Se assente in aggiornamento, la chiave gia salvata resta invariata;
 * la stringa vuota rimuove la chiave (utile per un endpoint locale senza auth).
 * I vincoli semantici (`base_url` per l'endpoint OpenAI-compatibile, chiave
 * richiesta per i provider remoti) sono verificati dal servizio.
 */
export const providerConfigInputSchema = z.object({
  id: z.string().min(1).optional(),
  kind: providerKindSchema,
  /** Etichetta leggibile, utile per un endpoint OpenAI-compatibile. */
  nome: z
    .string()
    .trim()
    .min(1, 'Il nome non puo essere vuoto')
    .max(120, NOME_TROPPO_LUNGO)
    .optional(),
  /** Indirizzo dell'endpoint, ad esempio `http://localhost:11434/v1`. */
  baseUrl: z.string().trim().url('Indirizzo non valido: usa una URL completa').optional(),
  generationModel: z
    .string()
    .trim()
    .min(1, "L'id del modello non puo essere vuoto")
    .max(200, MODELLO_TROPPO_LUNGO)
    .optional(),
  embeddingModel: z
    .string()
    .trim()
    .min(1, "L'id del modello non puo essere vuoto")
    .max(200, MODELLO_TROPPO_LUNGO)
    .optional(),
  /** Timeout della richiesta al provider, in millisecondi. */
  timeoutMs: z
    .number({ invalid_type_error: 'Il timeout deve essere un numero di millisecondi' })
    .int('Il timeout deve essere un numero intero di millisecondi')
    .positive('Il timeout deve essere maggiore di zero')
    .max(600_000, 'Il timeout non puo superare i 10 minuti')
    .optional(),
  privacy: modalitaPrivacySchema.optional(),
  /** Segreto in chiaro. Non attraversa mai il confine in uscita. */
  apiKey: z.string().max(4096, 'La chiave e troppo lunga').optional(),
  /**
   * Header di autenticazione per un endpoint OpenAI-compatibile sulla rete dello
   * studio (nome -> valore). Sono segreti: cifrati a riposo come la chiave e
   * mai restituiti. Solo per `openai-compatible`; ignorati per gli altri kind.
   * Presenti solo quando si (ri)definiscono: assenti in aggiornamento li lascia
   * invariati, l'oggetto vuoto li rimuove.
   */
  headers: z.record(nomeHeaderSchema, valoreHeaderSchema).optional()
})

/** Dati per creare o aggiornare un provider. */
export type ProviderConfigInput = z.infer<typeof providerConfigInputSchema>

/**
 * Vista di un provider configurato, priva di qualsiasi segreto: `haChiave`
 * segnala soltanto la presenza di una chiave, che non viene mai restituita.
 */
export const providerViewSchema = z.object({
  id: z.string(),
  kind: providerKindSchema,
  nome: z.string().nullable(),
  baseUrl: z.string().nullable(),
  generationModel: z.string().nullable(),
  embeddingModel: z.string().nullable(),
  timeoutMs: z.number().int().positive().nullable(),
  privacy: modalitaPrivacySchema,
  /** Presenza di una chiave cifrata, senza esporne il valore. */
  haChiave: z.boolean(),
  /** Quanti header di autenticazione custom sono configurati, senza esporli. */
  numeroHeader: z.number().int().nonnegative(),
  /** Provider attivo per le generazioni (al piu uno). */
  attivo: z.boolean(),
  creata_il: z.string(),
  aggiornata_il: z.string()
})

/** Vista non segreta di un provider configurato. */
export type ProviderView = z.infer<typeof providerViewSchema>

/** Richiesta della lista dei provider configurati. */
export const providerListRequestSchema = z.object({})

/** Risposta: i provider configurati, in ordine di creazione. */
export const providerListResponseSchema = z.object({
  providers: z.array(providerViewSchema)
})

/** Richiesta che riferisce un provider per identificativo. */
export const providerRefRequestSchema = z.object({
  id: z.string().min(1)
})

/** Risposta della cancellazione di un provider. */
export const providerDeleteResponseSchema = z.object({
  deleted: z.boolean()
})

/** Esito del test di connessione: stato e messaggio gia mascherato per la UI. */
export const providerTestResponseSchema = z.object({
  stato: statoConnessioneSchema,
  messaggio: z.string()
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
  upload: { request: uploadRequestSchema, response: uploadResponseSchema },
  providerList: { request: providerListRequestSchema, response: providerListResponseSchema },
  providerSave: { request: providerConfigInputSchema, response: providerViewSchema },
  providerDelete: { request: providerRefRequestSchema, response: providerDeleteResponseSchema },
  providerActivate: { request: providerRefRequestSchema, response: providerViewSchema },
  providerTest: { request: providerRefRequestSchema, response: providerTestResponseSchema }
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
export type ProviderListResponse = OperationResponse<'providerList'>
export type ProviderTestResult = OperationResponse<'providerTest'>

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
  'NOT_FOUND',
  'INTERNAL'
])

/** Codice di errore di un'operazione. */
export type OperationErrorCode = z.infer<typeof operationErrorCodeSchema>

/** Quante violazioni si riportano prima di troncare, per non allagare la UI. */
const MAX_VIOLAZIONI_DESCRITTE = 3

/**
 * Rende leggibile un errore di validazione Zod. `ZodError.message` e il JSON
 * completo delle violazioni: finisce tale e quale nel messaggio d'errore che
 * attraversa l'IPC e che la UI mostra all'utente, che si ritrova un dump al
 * posto di una spiegazione. Qui si riduce a `campo: motivo`, separati da «; ».
 *
 * I segmenti del percorso vengono ripuliti dai caratteri di controllo: possono
 * venire dall'input (la chiave di un `record`, cioe il nome di un header) e non
 * devono poter iniettare a capo nel messaggio.
 */
export function descriviErroriValidazione(error: z.ZodError): string {
  const violazioni = error.issues.slice(0, MAX_VIOLAZIONI_DESCRITTE).map((issue) => {
    const percorso = issue.path.map((segmento) => ripuliscePerMessaggio(segmento)).join('.')
    return percorso ? `${percorso}: ${issue.message}` : issue.message
  })

  const oltre = error.issues.length - violazioni.length
  if (oltre > 0) {
    violazioni.push(`e altri ${oltre} problemi`)
  }
  return violazioni.join('; ')
}

// I caratteri di controllo sono proprio cio che va tolto: la regola che ne
// vieta l'uso nei regex qui non si applica.
// eslint-disable-next-line no-control-regex
const CARATTERI_DI_CONTROLLO = /[\u0000-\u001f\u007f]+/g

/** Riduce un segmento di percorso a testo su una riga sola, senza controlli. */
function ripuliscePerMessaggio(segmento: PropertyKey): string {
  return String(segmento).replace(CARATTERI_DI_CONTROLLO, ' ').trim().slice(0, 80)
}

/**
 * Errore di dominio di un'operazione, con un codice stabile.
 * E serializzabile attraverso l'IPC tramite `toEnvelopeError`.
 */
export class OperationError extends Error {
  readonly code: OperationErrorCode

  constructor(code: OperationErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
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
