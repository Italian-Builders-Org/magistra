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

/** Engine che risponde con successo a generazione ed embedding. */
function engineOk(): LlmEngine {
  const handle: LlmStreamHandle = {
    textStream: (async function* () {
      yield 'pong'
    })(),
    text: Promise.resolve('pong'),
    toolCalls: Promise.resolve([]),
    finishReason: Promise.resolve('stop'),
    usage: Promise.resolve({ inputTokens: 1, outputTokens: 1, totalTokens: 2 })
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
      (e: unknown) => e instanceof Error && (e as { code?: string }).code === 'NOT_FOUND'
    )
  } finally {
    await store.close()
  }
})
