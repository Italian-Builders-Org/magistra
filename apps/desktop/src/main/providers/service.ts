import { z } from 'zod'

import type { ChiaveApi, ChiaveApiRepository } from '@magistra/data'
import {
  createProvider,
  ProviderError,
  type LlmEngine,
  type ProviderConfig
} from '@magistra/provider'
import {
  OperationError,
  modalitaPrivacySchema,
  providerConfigInputSchema,
  providerKindSchema,
  type ModalitaPrivacy,
  type ProviderConfigInput,
  type ProviderKind,
  type ProviderTestResult,
  type ProviderView,
  type StatoConnessione
} from '@magistra/shared'

import type { SecretCipher } from './secret-cipher'

// Servizio della gestione delle API key (configurazione dei provider).
//
// Cabla insieme tre pezzi gia esistenti, tenendo il segreto separato dalla
// configurazione:
//   - lo strato dati (`ChiaveApiRepository`) conserva la riga: il provider, la
//     chiave gia cifrata e la configurazione non segreta come JSON;
//   - la porta `SecretCipher` cifra/decifra il segreto (vault del SO,
//     AES-256-GCM): la chiave in chiaro non viene mai scritta ne restituita;
//   - l'astrazione dei provider (`@magistra/provider`) testa la connessione.
//
// La separazione segreto/configurazione della base di conoscenza vive qui: la
// vista restituita alla UI non contiene mai la chiave, solo `haChiave`.

/** Timeout predefinito del test di connessione, se la config non ne fissa uno. */
const TIMEOUT_TEST_PREDEFINITO_MS = 15_000

/** Numero massimo di token generati dal test di connessione (deve solo rispondere). */
const MAX_TOKEN_TEST = 1

/**
 * Configurazione non segreta conservata in `chiave_api.configurazione`.
 * E lo schema con cui la si rilegge dal database in modo difensivo: una riga
 * scritta da una versione futura con campi in piu non fa cadere la lettura.
 */
const configurazioneSchema = z.object({
  nome: z.string().nullable().default(null),
  baseUrl: z.string().nullable().default(null),
  generationModel: z.string().nullable().default(null),
  embeddingModel: z.string().nullable().default(null),
  timeoutMs: z.number().int().positive().nullable().default(null),
  privacy: modalitaPrivacySchema.default('standard'),
  haChiave: z.boolean().default(false),
  numeroHeader: z.number().int().nonnegative().default(0),
  attivo: z.boolean().default(false)
})

type Configurazione = z.infer<typeof configurazioneSchema>

/**
 * I segreti di un provider, cifrati insieme in `chiave_api.valore_cifrato`.
 * La chiave e gli header di autenticazione sono entrambi segreti: viaggiano
 * come un unico blob JSON cifrato, cosi la colonna resta l'unico contenitore dei
 * segreti e nulla di sensibile finisce nella configurazione in chiaro.
 */
interface SegretiProvider {
  apiKey?: string
  headers?: Record<string, string>
}

/** Dipendenze del servizio, tutte iniettabili per la testabilita. */
export interface ProviderSettingsDeps {
  /** Repository delle chiavi API dello strato dati. */
  readonly chiaviApi: ChiaveApiRepository
  /** Cifratura dei segreti (vault del SO in produzione, finta nei test). */
  readonly cipher: SecretCipher
  /**
   * Fetta del Vercel AI SDK usata dal test di connessione. In produzione si usa
   * quella reale del pacchetto provider; i test ne iniettano una controllabile.
   */
  readonly engine?: LlmEngine
}

/** Il servizio della gestione delle API key. */
export interface ProviderSettingsService {
  list(): Promise<ProviderView[]>
  save(input: ProviderConfigInput): Promise<ProviderView>
  remove(id: string): Promise<boolean>
  activate(id: string): Promise<ProviderView>
  testConnection(id: string): Promise<ProviderTestResult>
}

/** Costruisce il servizio della configurazione dei provider. */
export function createProviderSettingsService(deps: ProviderSettingsDeps): ProviderSettingsService {
  const { chiaviApi, cipher, engine } = deps

  async function list(): Promise<ProviderView[]> {
    const righe = await chiaviApi.list()
    return righe.map(toView)
  }

  async function caricaRiga(id: string): Promise<ChiaveApi> {
    const riga = await chiaviApi.get(id)
    if (!riga) {
      throw new OperationError('NOT_FOUND', `Nessun provider con id «${id}».`)
    }
    return riga
  }

  async function save(input: ProviderConfigInput): Promise<ProviderView> {
    const dati = parseInput(input)
    const kind = providerKindSchema.parse(dati.kind)

    return dati.id ? await aggiorna(dati.id, dati, kind) : await crea(dati, kind)
  }

  async function cifraSegreti(segreti: SegretiProvider): Promise<string> {
    return cipher.encrypt(JSON.stringify(segreti))
  }

  async function decifraSegreti(valore_cifrato: string): Promise<SegretiProvider> {
    try {
      const parsed = JSON.parse(await cipher.decrypt(valore_cifrato)) as unknown
      return isSegretiProvider(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  async function crea(dati: ProviderConfigInput, kind: ProviderKind): Promise<ProviderView> {
    verificaVincoli(kind, dati, { chiaveGiaPresente: false })

    const segreti = normalizzaSegreti(kind, dati.apiKey, dati.headers)
    const valore_cifrato = await cifraSegreti(segreti)

    // Il primo provider configurato diventa attivo, cosi l'app ne ha subito uno.
    const nessunProvider = (await chiaviApi.list()).length === 0

    const configurazione = buildConfigurazione(dati, {
      haChiave: !!segreti.apiKey,
      numeroHeader: contaHeader(segreti.headers),
      attivo: nessunProvider,
      privacy: dati.privacy ?? 'standard'
    })

    const riga = await chiaviApi.create({ provider: kind, valore_cifrato, configurazione })
    return toView(riga)
  }

  async function aggiorna(
    id: string,
    dati: ProviderConfigInput,
    kind: ProviderKind
  ): Promise<ProviderView> {
    const esistente = await caricaRiga(id)
    const configEsistente = parseConfigurazione(esistente.configurazione)

    verificaVincoli(kind, dati, { chiaveGiaPresente: configEsistente.haChiave })

    // Un segreto si aggiorna solo se ridefinito: `apiKey` assente lascia la
    // chiave invariata (la stringa vuota la rimuove); `headers` assente lascia
    // gli header invariati (l'oggetto vuoto li rimuove). Gli header valgono solo
    // per l'endpoint OpenAI-compatibile.
    const cambiaChiave = typeof dati.apiKey === 'string'
    const cambiaHeaders = dati.headers !== undefined && kind === 'openai-compatible'

    let valore_cifrato: string | undefined
    let haChiave = configEsistente.haChiave
    let numeroHeader = configEsistente.numeroHeader

    if (cambiaChiave || cambiaHeaders) {
      // Si rilegge il blob esistente per non perdere il segreto che non cambia.
      const esistenti = await decifraSegreti(esistente.valore_cifrato)
      const apiKey = cambiaChiave ? normalizzaChiave(dati.apiKey) : esistenti.apiKey
      const headers = cambiaHeaders ? normalizzaHeader(dati.headers) : esistenti.headers
      const segreti = componiSegreti(apiKey, headers)
      valore_cifrato = await cifraSegreti(segreti)
      haChiave = !!apiKey
      numeroHeader = contaHeader(headers)
    }

    const configurazione = buildConfigurazione(dati, {
      haChiave,
      numeroHeader,
      attivo: configEsistente.attivo,
      privacy: dati.privacy ?? configEsistente.privacy
    })

    const patch: Parameters<ChiaveApiRepository['update']>[1] = { provider: kind, configurazione }
    if (valore_cifrato !== undefined) {
      patch.valore_cifrato = valore_cifrato
    }

    const riga = await chiaviApi.update(id, patch)
    if (!riga) {
      throw new OperationError('NOT_FOUND', `Nessun provider con id «${id}».`)
    }
    return toView(riga)
  }

  async function remove(id: string): Promise<boolean> {
    return chiaviApi.delete(id)
  }

  async function activate(id: string): Promise<ProviderView> {
    const righe = await chiaviApi.list()
    const bersaglio = righe.find((riga) => riga.id === id)
    if (!bersaglio) {
      throw new OperationError('NOT_FOUND', `Nessun provider con id «${id}».`)
    }

    // Attivo esclusivo: si disattivano gli altri e si attiva il bersaglio.
    let aggiornato: ChiaveApi | null = null
    for (const riga of righe) {
      const config = parseConfigurazione(riga.configurazione)
      const attivoAtteso = riga.id === id
      if (config.attivo === attivoAtteso) {
        if (riga.id === id) aggiornato = riga
        continue
      }
      const riscritta = await chiaviApi.update(riga.id, {
        configurazione: { ...config, attivo: attivoAtteso }
      })
      if (riga.id === id) aggiornato = riscritta
    }

    return toView(aggiornato ?? bersaglio)
  }

  async function testConnection(id: string): Promise<ProviderTestResult> {
    const riga = await caricaRiga(id)
    const config = parseConfigurazione(riga.configurazione)
    const kind = providerKindSchema.parse(riga.provider)

    if (!config.generationModel && !config.embeddingModel) {
      return esito('modello_mancante', 'Nessun modello selezionato per questo provider.')
    }

    const segreti = await decifraSegreti(riga.valore_cifrato)

    let provider
    try {
      provider = createProvider(buildProviderConfig(kind, config, segreti), { engine })
    } catch (errore) {
      if (errore instanceof ProviderError && errore.code === 'INVALID_CONFIG') {
        return esito('modello_mancante', 'Configurazione del provider incompleta.')
      }
      throw errore
    }

    const controller = new AbortController()
    const timeoutMs = config.timeoutMs ?? TIMEOUT_TEST_PREDEFINITO_MS
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      if (provider.language) {
        await provider.language.generate({
          messages: [{ role: 'user', content: 'ping' }],
          maxOutputTokens: MAX_TOKEN_TEST,
          abortSignal: controller.signal
        })
      } else {
        await provider.requireEmbedding().embed('ping')
      }
      return esito('ok', 'Provider raggiungibile.')
    } catch (errore) {
      return interpretaErrore(errore)
    } finally {
      clearTimeout(timer)
    }
  }

  return { list, save, remove, activate, testConnection }
}

// === Helper puri =============================================================

/**
 * Valida di nuovo l'input con lo schema condiviso: il servizio puo essere
 * chiamato anche fuori dall'IPC (test), quindi non si fida della validazione a
 * monte. Un input non valido diventa `OperationError` `INVALID_REQUEST`.
 */
function parseInput(input: ProviderConfigInput): ProviderConfigInput {
  const esito = providerConfigInputSchema.safeParse(input)
  if (!esito.success) {
    throw new OperationError('INVALID_REQUEST', `Configurazione non valida: ${esito.error.message}`)
  }
  return esito.data
}

/**
 * Vincoli semantici non esprimibili nello schema piatto: la `base_url` e
 * obbligatoria per l'endpoint OpenAI-compatibile; i provider remoti richiedono
 * una chiave (alla creazione, o se quella salvata viene rimossa).
 */
function verificaVincoli(
  kind: ProviderKind,
  dati: ProviderConfigInput,
  opzioni: { chiaveGiaPresente: boolean }
): void {
  if (kind === 'openai-compatible') {
    if (!dati.baseUrl) {
      throw new OperationError(
        'INVALID_REQUEST',
        "L'endpoint OpenAI-compatibile richiede una base URL."
      )
    }
    return
  }

  // Provider remoto: la chiave e obbligatoria. E soddisfatta se arriva ora,
  // oppure se ne esiste gia una e non la si sta rimuovendo.
  const chiaveInArrivo = typeof dati.apiKey === 'string' && dati.apiKey.length > 0
  const rimuoveChiave = dati.apiKey === ''
  const chiaveDisponibile = chiaveInArrivo || (opzioni.chiaveGiaPresente && !rimuoveChiave)
  if (!chiaveDisponibile) {
    throw new OperationError('INVALID_REQUEST', `Il provider «${kind}» richiede una API key.`)
  }
}

/** Costruisce la configurazione non segreta da conservare. */
function buildConfigurazione(
  dati: ProviderConfigInput,
  stato: { haChiave: boolean; numeroHeader: number; attivo: boolean; privacy: ModalitaPrivacy }
): Configurazione {
  return {
    nome: dati.nome ?? null,
    baseUrl: dati.baseUrl ?? null,
    generationModel: dati.generationModel ?? null,
    embeddingModel: dati.embeddingModel ?? null,
    timeoutMs: dati.timeoutMs ?? null,
    privacy: stato.privacy,
    haChiave: stato.haChiave,
    numeroHeader: stato.numeroHeader,
    attivo: stato.attivo
  }
}

/** Rilegge la configurazione dal database in modo difensivo. */
function parseConfigurazione(value: Record<string, unknown>): Configurazione {
  return configurazioneSchema.parse(value ?? {})
}

/** Proietta una riga sulla vista non segreta esposta alla UI. */
function toView(riga: ChiaveApi): ProviderView {
  const config = parseConfigurazione(riga.configurazione)
  return {
    id: riga.id,
    kind: providerKindSchema.parse(riga.provider),
    nome: config.nome,
    baseUrl: config.baseUrl,
    generationModel: config.generationModel,
    embeddingModel: config.embeddingModel,
    timeoutMs: config.timeoutMs,
    privacy: config.privacy,
    haChiave: config.haChiave,
    numeroHeader: config.numeroHeader,
    attivo: config.attivo,
    creata_il: riga.creata_il,
    aggiornata_il: riga.aggiornata_il
  }
}

/** Mappa la configurazione salvata sulla configurazione del pacchetto provider. */
function buildProviderConfig(
  kind: ProviderKind,
  config: Configurazione,
  segreti: SegretiProvider
): ProviderConfig {
  const generationModel = config.generationModel ?? undefined
  const embeddingModel = config.embeddingModel ?? undefined
  const apiKey = segreti.apiKey

  switch (kind) {
    case 'anthropic':
      return {
        kind,
        apiKey: apiKey ?? '',
        generationModel: generationModel ?? '',
        baseUrl: config.baseUrl ?? undefined
      }
    case 'openai':
    case 'google':
      return {
        kind,
        apiKey: apiKey ?? '',
        generationModel,
        embeddingModel,
        baseUrl: config.baseUrl ?? undefined
      }
    case 'openai-compatible':
      return {
        kind,
        baseUrl: config.baseUrl ?? '',
        apiKey,
        name: config.nome ?? undefined,
        generationModel,
        embeddingModel,
        // Gli header di autenticazione valgono solo qui (server sulla rete dello studio).
        headers: segreti.headers
      }
  }
}

/**
 * Traduce un errore del test in uno stato per la UI, senza mai riportare il
 * messaggio grezzo del provider (potrebbe contenere dettagli sensibili): un
 * modello assente/non offerto diventa `modello_mancante`, ogni altro guasto
 * (endpoint spento, credenziali rifiutate, timeout) `non_raggiungibile`.
 */
function interpretaErrore(errore: unknown): ProviderTestResult {
  if (errore instanceof ProviderError) {
    if (errore.code === 'UNSUPPORTED_CAPABILITY') {
      return esito('modello_mancante', 'Il provider non offre il modello richiesto.')
    }
    if (errore.code === 'INVALID_CONFIG') {
      return esito('modello_mancante', 'Configurazione del provider incompleta.')
    }
    // Si ispeziona la causa originale (errore dell'SDK o della rete), non il
    // messaggio avvolto: quest'ultimo contiene sempre la parola «modello».
    const causa = errore.cause instanceof Error ? errore.cause.message : ''
    if (sembraModelloMancante(causa)) {
      return esito('modello_mancante', 'Il modello indicato non esiste sul provider.')
    }
    return esito('non_raggiungibile', 'Provider non raggiungibile o credenziali rifiutate.')
  }
  return esito('non_raggiungibile', 'Provider non raggiungibile.')
}

/** Euristica leggera: l'errore parla di un modello inesistente. */
function sembraModelloMancante(messaggio: string): boolean {
  return /model|modello|not found|404|does not exist|no such/i.test(messaggio)
}

function esito(stato: StatoConnessione, messaggio: string): ProviderTestResult {
  return { stato, messaggio }
}

// === Gestione dei segreti ====================================================

/** Normalizza la chiave: la stringa vuota o assente equivale a nessuna chiave. */
function normalizzaChiave(apiKey: string | undefined): string | undefined {
  return apiKey && apiKey.length > 0 ? apiKey : undefined
}

/**
 * Normalizza gli header: scarta le voci con valore vuoto e restituisce
 * `undefined` se non ne resta alcuno, cosi «nessun header» e sempre `undefined`.
 */
function normalizzaHeader(
  headers: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!headers) return undefined
  const voci = Object.entries(headers).filter(
    ([nome, valore]) => nome.length > 0 && valore.length > 0
  )
  return voci.length > 0 ? Object.fromEntries(voci) : undefined
}

/** Costruisce il blob dei segreti a partire dai segreti gia normalizzati. */
function componiSegreti(
  apiKey: string | undefined,
  headers: Record<string, string> | undefined
): SegretiProvider {
  const segreti: SegretiProvider = {}
  if (apiKey) segreti.apiKey = apiKey
  if (headers) segreti.headers = headers
  return segreti
}

/**
 * Normalizza chiave e header per la creazione. Gli header valgono solo per
 * l'endpoint OpenAI-compatibile: per gli altri kind vengono scartati.
 */
function normalizzaSegreti(
  kind: ProviderKind,
  apiKey: string | undefined,
  headers: Record<string, string> | undefined
): SegretiProvider {
  const headerAmmessi = kind === 'openai-compatible' ? normalizzaHeader(headers) : undefined
  return componiSegreti(normalizzaChiave(apiKey), headerAmmessi)
}

/** Conta gli header configurati senza esporli. */
function contaHeader(headers: Record<string, string> | undefined): number {
  return headers ? Object.keys(headers).length : 0
}

/** Verifica difensiva della forma del blob decifrato. */
function isSegretiProvider(value: unknown): value is SegretiProvider {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const apiKeyOk = record['apiKey'] === undefined || typeof record['apiKey'] === 'string'
  const headersOk =
    record['headers'] === undefined ||
    (typeof record['headers'] === 'object' && record['headers'] !== null)
  return apiKeyOk && headersOk
}
