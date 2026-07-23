import assert from 'node:assert/strict'
import test from 'node:test'

import { openDataStore, type DataStore } from '@magistra/data'
import type { LlmEngine, LlmStreamHandle } from '@magistra/provider'

import { createProviderSettingsService } from '../../src/main/providers/service.ts'
import type { SecretCipher } from '../../src/main/providers/secret-cipher.ts'

// Il servizio si esercita senza Electron: il vault del SO e sostituito da una
// cifratura finta (ma reversibile), e il Vercel AI SDK da un engine finto. Lo
// strato dati e invece quello vero (PGlite in memoria), cosi si prova davvero
// che il segreto non finisca mai in chiaro nel database.

/**
 * Cifratura finta e reversibile: prefisso + base64. Non protegge nulla, serve
 * solo a verificare che il chiaro non attraversi lo strato dati.
 */
const cipherFinto: SecretCipher = {
  async encrypt(plainText) {
    return `enc:${Buffer.from(plainText, 'utf8').toString('base64')}`
  },
  async decrypt(cipherText) {
    return Buffer.from(cipherText.slice(4), 'base64').toString('utf8')
  }
}

/** Conteggio di token minimo ma completo, come lo restituisce il Vercel AI SDK. */
const USO_FINTO = {
  inputTokens: 1,
  inputTokenDetails: {
    noCacheTokens: 1,
    cacheReadTokens: 0,
    cacheWriteTokens: 0
  },
  outputTokens: 1,
  outputTokenDetails: {
    textTokens: 1,
    reasoningTokens: 0
  },
  totalTokens: 2
}

/** Engine che risponde con successo a generazione ed embedding. */
function engineOk(): LlmEngine {
  const handle: LlmStreamHandle = {
    textStream: (async function* () {
      yield 'pong'
    })(),
    text: Promise.resolve('pong'),
    toolCalls: Promise.resolve([]),
    finishReason: Promise.resolve('stop'),
    usage: Promise.resolve(USO_FINTO)
  }
  return {
    streamText: () => handle,
    embed: async () => ({ embedding: [0.1, 0.2] }),
    embedMany: async () => ({ embeddings: [[0.1, 0.2]] })
  }
}

/** Engine che simula un endpoint irraggiungibile (rete assente). */
function engineRete(errore: Error): LlmEngine {
  // Ogni chiamata costruisce un handle nuovo, con un handler sincrono su ogni
  // Promise: cosi il rigetto non diventa un unhandledRejection prima che lo
  // strato del provider lo consumi (l'errore viaggia comunque a chi attende).
  function rifiutata(): Promise<never> {
    const p = Promise.reject(errore)
    p.catch(() => {})
    return p
  }
  return {
    streamText: (): LlmStreamHandle => ({
      textStream: (async function* () {
        yield* []
        throw errore
      })(),
      text: rifiutata(),
      toolCalls: rifiutata(),
      finishReason: rifiutata(),
      usage: rifiutata()
    }),
    embed: async () => {
      throw errore
    },
    embedMany: async () => {
      throw errore
    }
  }
}

/** Cifra correttamente ma non sa piu decifrare: keyring ruotato o corrotto. */
const cipherIlleggibile: SecretCipher = {
  encrypt: cipherFinto.encrypt,
  async decrypt() {
    throw new Error('KEY_ID_NOT_FOUND')
  }
}

/** Engine che non risponde mai: serve a provare la scadenza del test. */
function engineAppeso(): LlmEngine {
  const mai = new Promise<never>(() => {})
  return {
    streamText: () => ({
      textStream: (async function* () {
        yield* []
        await mai
      })(),
      text: mai,
      toolCalls: mai,
      finishReason: mai,
      usage: mai
    }),
    embed: () => mai,
    embedMany: () => mai
  }
}

async function nuovoServizio(engine?: LlmEngine): Promise<{
  store: DataStore
  service: ReturnType<typeof createProviderSettingsService>
}> {
  const store = await openDataStore()
  const service = createProviderSettingsService({
    chiaviApi: store.chiaviApi,
    cipher: cipherFinto,
    engine
  })
  return { store, service }
}

/** Codice di un `OperationError` che ha attraversato un confine. */
function codice(e: unknown): string | undefined {
  return e instanceof Error ? (e as { code?: string }).code : undefined
}

test('crea un provider remoto, cifra la chiave e attiva il primo', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const view = await service.save({
      kind: 'anthropic',
      generationModel: 'claude-sonnet-5',
      apiKey: 'sk-super-segreta'
    })

    assert.equal(view.kind, 'anthropic')
    assert.equal(view.haChiave, true)
    assert.equal(view.attivo, true, 'il primo provider e attivo')
    assert.equal(view.generationModel, 'claude-sonnet-5')
    // La vista non espone mai il segreto.
    assert.equal('apiKey' in view, false)

    // Il chiaro non compare da nessuna parte nella riga persistita.
    const riga = await store.chiaviApi.get(view.id)
    assert.ok(riga)
    assert.ok(!JSON.stringify(riga).includes('sk-super-segreta'))
    assert.equal(riga!.configurazione.haChiave, true)
  } finally {
    await store.close()
  }
})

test('rifiuta un provider remoto senza chiave', async () => {
  const { store, service } = await nuovoServizio()
  try {
    await assert.rejects(
      () => service.save({ kind: 'openai', generationModel: 'gpt-4o' }),
      (e: unknown) => e instanceof Error && (e as { code?: string }).code === 'INVALID_REQUEST'
    )
  } finally {
    await store.close()
  }
})

test("l'endpoint OpenAI-compatibile richiede una base URL", async () => {
  const { store, service } = await nuovoServizio()
  try {
    await assert.rejects(
      () => service.save({ kind: 'openai-compatible', generationModel: 'qwen2.5' }),
      (e: unknown) => e instanceof Error && (e as { code?: string }).code === 'INVALID_REQUEST'
    )
  } finally {
    await store.close()
  }
})

test('accetta un endpoint locale senza chiave', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const view = await service.save({
      kind: 'openai-compatible',
      nome: 'Ollama',
      baseUrl: 'http://localhost:11434/v1',
      generationModel: 'qwen2.5'
    })
    assert.equal(view.haChiave, false)
    assert.equal(view.nome, 'Ollama')
    assert.equal(view.baseUrl, 'http://localhost:11434/v1')
  } finally {
    await store.close()
  }
})

test('cifra gli header di autenticazione senza esporli in chiaro', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const view = await service.save({
      kind: 'openai-compatible',
      baseUrl: 'https://gpu.studio.local/v1',
      generationModel: 'qwen2.5',
      headers: { Authorization: 'Bearer super-token', 'X-Studio': 'roma' }
    })
    assert.equal(view.numeroHeader, 2)
    assert.equal('headers' in view, false)

    // Ne il valore ne la configurazione contengono il token in chiaro.
    const riga = await store.chiaviApi.get(view.id)
    assert.ok(!JSON.stringify(riga).includes('super-token'))
    assert.equal(JSON.stringify(riga!.configurazione).includes('super-token'), false)
  } finally {
    await store.close()
  }
})

test('gli header sono ignorati per i provider remoti', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const view = await service.save({
      kind: 'openai',
      generationModel: 'gpt-4o',
      apiKey: 'sk-a',
      headers: { Authorization: 'Bearer x' }
    })
    assert.equal(view.numeroHeader, 0)
  } finally {
    await store.close()
  }
})

test('in modifica gli header assenti restano invariati, la chiave pure', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const creato = await service.save({
      kind: 'openai-compatible',
      baseUrl: 'https://gpu.studio.local/v1',
      generationModel: 'qwen2.5',
      apiKey: 'sk-locale',
      headers: { Authorization: 'Bearer t1' }
    })
    const rigaPrima = await store.chiaviApi.get(creato.id)

    // Cambia solo il modello: chiave e header non toccati.
    const modificato = await service.save({
      id: creato.id,
      kind: 'openai-compatible',
      baseUrl: 'https://gpu.studio.local/v1',
      generationModel: 'llama3.1'
    })
    assert.equal(modificato.numeroHeader, 1)
    assert.equal(modificato.haChiave, true)
    const rigaDopo = await store.chiaviApi.get(creato.id)
    assert.equal(rigaDopo!.valore_cifrato, rigaPrima!.valore_cifrato, 'i segreti non cambiano')
  } finally {
    await store.close()
  }
})

test('in modifica un oggetto header vuoto li rimuove', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const creato = await service.save({
      kind: 'openai-compatible',
      baseUrl: 'https://gpu.studio.local/v1',
      generationModel: 'qwen2.5',
      headers: { Authorization: 'Bearer t1' }
    })
    assert.equal(creato.numeroHeader, 1)

    const modificato = await service.save({
      id: creato.id,
      kind: 'openai-compatible',
      baseUrl: 'https://gpu.studio.local/v1',
      generationModel: 'qwen2.5',
      headers: {}
    })
    assert.equal(modificato.numeroHeader, 0)
  } finally {
    await store.close()
  }
})

test('in modifica senza apiKey la chiave resta invariata', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const creato = await service.save({
      kind: 'openai',
      generationModel: 'gpt-4o',
      apiKey: 'sk-originale'
    })
    const rigaPrima = await store.chiaviApi.get(creato.id)

    const modificato = await service.save({
      id: creato.id,
      kind: 'openai',
      generationModel: 'gpt-4o-mini'
    })
    assert.equal(modificato.generationModel, 'gpt-4o-mini')
    assert.equal(modificato.haChiave, true)

    const rigaDopo = await store.chiaviApi.get(creato.id)
    assert.equal(
      rigaDopo!.valore_cifrato,
      rigaPrima!.valore_cifrato,
      'la chiave cifrata non cambia'
    )
  } finally {
    await store.close()
  }
})

test("l'attivazione e esclusiva", async () => {
  const { store, service } = await nuovoServizio()
  try {
    const primo = await service.save({
      kind: 'anthropic',
      generationModel: 'claude-sonnet-5',
      apiKey: 'sk-a'
    })
    const secondo = await service.save({
      kind: 'openai',
      generationModel: 'gpt-4o',
      apiKey: 'sk-b'
    })
    assert.equal(primo.attivo, true)
    assert.equal(secondo.attivo, false)

    const attivato = await service.activate(secondo.id)
    assert.equal(attivato.attivo, true)

    const lista = await service.list()
    const primoDopo = lista.find((p) => p.id === primo.id)
    assert.equal(primoDopo!.attivo, false, 'il precedente attivo viene disattivato')
  } finally {
    await store.close()
  }
})

test('test connessione: nessun modello selezionato => modello_mancante', async () => {
  const { store, service } = await nuovoServizio(engineOk())
  try {
    const view = await service.save({
      kind: 'openai-compatible',
      baseUrl: 'http://localhost:11434/v1'
    })
    const esito = await service.testConnection(view.id)
    assert.equal(esito.stato, 'modello_mancante')
  } finally {
    await store.close()
  }
})

test('test connessione: provider raggiungibile => ok', async () => {
  const { store, service } = await nuovoServizio(engineOk())
  try {
    const view = await service.save({
      kind: 'anthropic',
      generationModel: 'claude-sonnet-5',
      apiKey: 'sk-a'
    })
    const esito = await service.testConnection(view.id)
    assert.equal(esito.stato, 'ok')
  } finally {
    await store.close()
  }
})

test('test connessione: rete assente => non_raggiungibile', async () => {
  const { store, service } = await nuovoServizio(engineRete(new Error('ECONNREFUSED')))
  try {
    const view = await service.save({
      kind: 'anthropic',
      generationModel: 'claude-sonnet-5',
      apiKey: 'sk-a'
    })
    const esito = await service.testConnection(view.id)
    assert.equal(esito.stato, 'non_raggiungibile')
    assert.ok(!esito.messaggio.includes('sk-a'), 'il messaggio non espone il segreto')
  } finally {
    await store.close()
  }
})

test('test connessione: modello inesistente sul provider => modello_mancante', async () => {
  const { store, service } = await nuovoServizio(engineRete(new Error('model not found: 404')))
  try {
    const view = await service.save({
      kind: 'openai',
      generationModel: 'gpt-inesistente',
      apiKey: 'sk-a'
    })
    const esito = await service.testConnection(view.id)
    assert.equal(esito.stato, 'modello_mancante')
  } finally {
    await store.close()
  }
})

test('elimina un provider', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const view = await service.save({
      kind: 'anthropic',
      generationModel: 'claude-sonnet-5',
      apiKey: 'sk-a'
    })
    assert.equal(await service.remove(view.id), true)
    assert.deepEqual(await service.list(), [])
  } finally {
    await store.close()
  }
})

test('testConnection su id inesistente => NOT_FOUND', async () => {
  const { store, service } = await nuovoServizio(engineOk())
  try {
    await assert.rejects(
      () => service.testConnection('inesistente'),
      (e: unknown) => codice(e) === 'NOT_FOUND'
    )
  } finally {
    await store.close()
  }
})

// === Segreti illeggibili =====================================================

test('se la decifratura fallisce, la modifica si interrompe senza toccare i segreti', async () => {
  const store = await openDataStore()
  try {
    // Si crea con una cifratura sana, poi il vault diventa illeggibile: e
    // esattamente cio che accade se il keyring viene ruotato o si corrompe.
    const sano = createProviderSettingsService({ chiaviApi: store.chiaviApi, cipher: cipherFinto })
    const creato = await sano.save({
      kind: 'openai-compatible',
      baseUrl: 'https://gpu.studio.local/v1',
      generationModel: 'qwen2.5',
      apiKey: 'sk-chiave-utente',
      headers: { Authorization: 'Bearer t1' }
    })
    const rigaPrima = await store.chiaviApi.get(creato.id)

    const rotto = createProviderSettingsService({
      chiaviApi: store.chiaviApi,
      cipher: cipherIlleggibile
    })
    // L'utente cambia i soli header: la chiave non deve essere distrutta.
    await assert.rejects(
      () =>
        rotto.save({
          id: creato.id,
          kind: 'openai-compatible',
          baseUrl: 'https://gpu.studio.local/v1',
          generationModel: 'qwen2.5',
          headers: { Authorization: 'Bearer t2' }
        }),
      (e: unknown) => codice(e) === 'INTERNAL'
    )

    const rigaDopo = await store.chiaviApi.get(creato.id)
    assert.equal(rigaDopo!.valore_cifrato, rigaPrima!.valore_cifrato, 'il blob non viene riscritto')
    assert.equal(rigaDopo!.configurazione.haChiave, true, 'la chiave risulta ancora presente')
  } finally {
    await store.close()
  }
})

test('segreti illeggibili: il test di connessione lo riporta, senza esplodere', async () => {
  const store = await openDataStore()
  try {
    const sano = createProviderSettingsService({ chiaviApi: store.chiaviApi, cipher: cipherFinto })
    const creato = await sano.save({
      kind: 'anthropic',
      generationModel: 'claude-sonnet-5',
      apiKey: 'sk-a'
    })

    const rotto = createProviderSettingsService({
      chiaviApi: store.chiaviApi,
      cipher: cipherIlleggibile,
      engine: engineOk()
    })
    const esito = await rotto.testConnection(creato.id)
    assert.equal(esito.stato, 'non_raggiungibile')
    assert.match(esito.messaggio, /decifrare/i)
  } finally {
    await store.close()
  }
})

// === Scadenza del test =======================================================

test('il timeout vale anche sul percorso di embedding, che non onora l abort', async () => {
  const { store, service } = await nuovoServizio(engineAppeso())
  try {
    // Solo modello di embedding: il provider non ha capacita generativa, quindi
    // il test passa da `embed`, che un AbortSignal non lo accetta.
    const view = await service.save({
      kind: 'openai',
      embeddingModel: 'text-embedding-3-small',
      apiKey: 'sk-a',
      timeoutMs: 50
    })
    const esito = await service.testConnection(view.id)
    assert.equal(esito.stato, 'non_raggiungibile')
    assert.match(esito.messaggio, /timeout/i)
  } finally {
    await store.close()
  }
})

// === Robustezza della configurazione ========================================

test('i campi sconosciuti nella configurazione sopravvivono al salvataggio', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const creato = await service.save({
      kind: 'anthropic',
      generationModel: 'claude-sonnet-5',
      apiKey: 'sk-a'
    })
    // Simula una riga scritta da un'altra versione, con un campo in piu.
    const riga = await store.chiaviApi.get(creato.id)
    await store.chiaviApi.update(creato.id, {
      configurazione: { ...riga!.configurazione, campoFuturo: 'da conservare' }
    })

    await service.save({ id: creato.id, kind: 'anthropic', generationModel: 'claude-opus-4-8' })

    const dopo = await store.chiaviApi.get(creato.id)
    assert.equal(dopo!.configurazione.campoFuturo, 'da conservare')
    assert.equal(dopo!.configurazione.generationModel, 'claude-opus-4-8')
  } finally {
    await store.close()
  }
})

test('una riga con configurazione fuori vocabolario non fa cadere la lista', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const creato = await service.save({
      kind: 'anthropic',
      generationModel: 'claude-sonnet-5',
      apiKey: 'sk-a'
    })
    // `privacy` con un valore che questa versione non conosce.
    await store.chiaviApi.update(creato.id, { configurazione: { privacy: 'paranoica' } })

    const lista = await service.list()
    assert.equal(lista.length, 1)
    assert.equal(lista[0]!.privacy, 'standard', 'ripiega sul default invece di lanciare')
  } finally {
    await store.close()
  }
})

// === Vincoli e ciclo di vita ================================================

test('eliminando il provider attivo, ne subentra un altro', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const primo = await service.save({
      kind: 'anthropic',
      generationModel: 'claude-sonnet-5',
      apiKey: 'sk-a'
    })
    const secondo = await service.save({
      kind: 'openai',
      generationModel: 'gpt-4o',
      apiKey: 'sk-b'
    })
    assert.equal(primo.attivo, true)

    await service.remove(primo.id)

    const lista = await service.list()
    assert.equal(lista.length, 1)
    assert.equal(lista[0]!.id, secondo.id)
    assert.equal(lista[0]!.attivo, true, 'l app non resta senza provider attivo')
  } finally {
    await store.close()
  }
})

test('eliminare un provider inesistente => NOT_FOUND', async () => {
  const { store, service } = await nuovoServizio()
  try {
    await assert.rejects(
      () => service.remove('inesistente'),
      (e: unknown) => codice(e) === 'NOT_FOUND'
    )
  } finally {
    await store.close()
  }
})

test('il tipo di provider non si puo cambiare in modifica', async () => {
  const { store, service } = await nuovoServizio()
  try {
    const creato = await service.save({
      kind: 'anthropic',
      generationModel: 'claude-sonnet-5',
      apiKey: 'sk-a'
    })
    await assert.rejects(
      () =>
        service.save({ id: creato.id, kind: 'openai', generationModel: 'gpt-4o', apiKey: 'sk-a' }),
      (e: unknown) => codice(e) === 'INVALID_REQUEST'
    )
  } finally {
    await store.close()
  }
})

test('un provider remoto si configura una volta sola, gli endpoint locali no', async () => {
  const { store, service } = await nuovoServizio()
  try {
    await service.save({ kind: 'anthropic', generationModel: 'claude-sonnet-5', apiKey: 'sk-a' })
    await assert.rejects(
      () => service.save({ kind: 'anthropic', generationModel: 'claude-opus-4-8', apiKey: 'sk-b' }),
      (e: unknown) => codice(e) === 'INVALID_REQUEST'
    )

    // Due macchine OpenAI-compatibili sono invece legittime.
    await service.save({
      kind: 'openai-compatible',
      baseUrl: 'http://localhost:11434/v1',
      generationModel: 'qwen2.5'
    })
    await service.save({
      kind: 'openai-compatible',
      baseUrl: 'https://gpu.studio.local/v1',
      generationModel: 'llama3.1'
    })
    assert.equal((await service.list()).length, 3)
  } finally {
    await store.close()
  }
})

test('un limite di rate che nomina il modello non diventa «modello mancante»', async () => {
  const { store, service } = await nuovoServizio(
    engineRete(new Error('429 Rate limit reached for model gpt-4o in organization org-x'))
  )
  try {
    const view = await service.save({
      kind: 'openai',
      generationModel: 'gpt-4o',
      apiKey: 'sk-a'
    })
    const esito = await service.testConnection(view.id)
    assert.equal(esito.stato, 'non_raggiungibile')
  } finally {
    await store.close()
  }
})

test('un nome di header con CRLF viene rifiutato', async () => {
  const { store, service } = await nuovoServizio()
  try {
    await assert.rejects(
      () =>
        service.save({
          kind: 'openai-compatible',
          baseUrl: 'https://gpu.studio.local/v1',
          generationModel: 'qwen2.5',
          headers: { 'X-Buono\r\nX-Iniettato': 'valore' }
        }),
      (e: unknown) => codice(e) === 'INVALID_REQUEST'
    )
  } finally {
    await store.close()
  }
})
