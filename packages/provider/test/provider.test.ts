import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createProvider, ProviderError } from '../src/index.ts'
import type { LlmEngine, LlmEngineStreamOptions, LlmStreamHandle } from '../src/index.ts'

// I test esercitano l'orchestrazione senza toccare la rete: si inietta un
// `LlmEngine` finto al posto del Vercel AI SDK. I modelli concreti vengono
// comunque costruiti dai factory reali (Anthropic, OpenAI, ...), ma sono solo
// oggetti di configurazione: il finto engine li ignora. Così si prova la
// traduzione della richiesta, lo streaming token-per-token, il tool calling e
// soprattutto il degrado controllato.

interface StreamScript {
  deltas?: string[]
  toolCalls?: Array<{ toolCallId: string; toolName: string; input: unknown }>
  finishReason?: string
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
  /** Errore sollevato durante l'iterazione dello stream di testo. */
  streamError?: Error
  /** Errore con cui si risolve la promessa del testo completo. */
  textError?: Error
}

interface EngineProbe {
  engine: LlmEngine
  lastStreamOptions?: LlmEngineStreamOptions
  embedCalls: string[][]
}

function makeEngine(options: {
  stream?: StreamScript
  embedError?: Error
  embedding?: number[]
  embeddings?: number[][]
}): EngineProbe {
  const probe: EngineProbe = {
    embedCalls: [],
    engine: {
      streamText(opts): LlmStreamHandle {
        probe.lastStreamOptions = opts
        const script = options.stream ?? {}
        const deltas = script.deltas ?? []

        async function* iterate(): AsyncGenerator<string> {
          for (const delta of deltas) {
            yield delta
          }
          if (script.streamError) throw script.streamError
        }

        const text = script.textError
          ? Promise.reject(script.textError)
          : Promise.resolve(deltas.join(''))

        return {
          textStream: iterate(),
          text,
          toolCalls: Promise.resolve(script.toolCalls ?? []),
          finishReason: Promise.resolve(script.finishReason ?? 'stop'),
          usage: Promise.resolve(
            (script.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 }) as never
          )
        }
      },
      async embed({ value }) {
        probe.embedCalls.push([value])
        if (options.embedError) throw options.embedError
        return { embedding: options.embedding ?? [0.1, 0.2, 0.3] }
      },
      async embedMany({ values }) {
        probe.embedCalls.push([...values])
        if (options.embedError) throw options.embedError
        return { embeddings: options.embeddings ?? values.map(() => [0.1, 0.2, 0.3]) }
      }
    }
  }
  return probe
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = []
  for await (const delta of stream) out.push(delta)
  return out
}

const OPENAI_LOCAL = {
  kind: 'openai-compatible',
  baseUrl: 'http://localhost:11434/v1',
  generationModel: 'qwen2.5',
  embeddingModel: 'nomic-embed-text'
} as const

// === Validazione della configurazione =======================================

test('createProvider rifiuta una configurazione non valida con INVALID_CONFIG', () => {
  assert.throws(
    () => createProvider({ kind: 'openai' }),
    (error: unknown) => error instanceof ProviderError && error.code === 'INVALID_CONFIG'
  )
})

test('createProvider rifiuta un provider senza alcun modello con INVALID_CONFIG', () => {
  assert.throws(
    () => createProvider({ kind: 'openai', apiKey: 'k' }),
    (error: unknown) => error instanceof ProviderError && error.code === 'INVALID_CONFIG'
  )
})

test("createProvider rifiuta l'endpoint OpenAI-compatibile senza base_url", () => {
  assert.throws(
    () => createProvider({ kind: 'openai-compatible', generationModel: 'm' }),
    (error: unknown) => error instanceof ProviderError && error.code === 'INVALID_CONFIG'
  )
})

// === Descrittore e capacità ==================================================

test('il descrittore riflette i modelli configurati e il base URL', () => {
  const { engine } = makeEngine({})
  const provider = createProvider(OPENAI_LOCAL, { engine })

  assert.equal(provider.descriptor.kind, 'openai-compatible')
  assert.equal(provider.descriptor.generationModelId, 'qwen2.5')
  assert.equal(provider.descriptor.embeddingModelId, 'nomic-embed-text')
  assert.equal(provider.descriptor.baseUrl, 'http://localhost:11434/v1')
  assert.ok(provider.language)
  assert.ok(provider.embedding)
})

test("Anthropic offre la generazione ma non l'embedding", () => {
  const { engine } = makeEngine({})
  const provider = createProvider(
    { kind: 'anthropic', apiKey: 'k', generationModel: 'claude-sonnet-5' },
    { engine }
  )

  assert.ok(provider.language)
  assert.equal(provider.embedding, null)
  assert.throws(
    () => provider.requireEmbedding(),
    (error: unknown) => error instanceof ProviderError && error.code === 'UNSUPPORTED_CAPABILITY'
  )
})

// === Streaming e generazione =================================================

test('stream espone i token uno a uno e aggrega testo, tool e usage', async () => {
  const probe = makeEngine({
    stream: {
      deltas: ['Ciao', ', ', 'mondo'],
      toolCalls: [{ toolCallId: 't1', toolName: 'cerca', input: { q: 'x' } }],
      finishReason: 'tool-calls',
      usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 }
    }
  })
  const provider = createProvider(OPENAI_LOCAL, { engine: probe.engine })
  const language = provider.requireLanguage()

  const result = language.stream({ messages: [{ role: 'user', content: 'salve' }] })

  assert.deepEqual(await collect(result.textStream), ['Ciao', ', ', 'mondo'])
  assert.equal(await result.text, 'Ciao, mondo')
  assert.deepEqual(await result.toolCalls, [
    { toolCallId: 't1', toolName: 'cerca', input: { q: 'x' } }
  ])
  assert.equal(await result.finishReason, 'tool-calls')
  assert.deepEqual(await result.usage, { inputTokens: 3, outputTokens: 5, totalTokens: 8 })
})

test('la richiesta inoltra system, tools e toolChoice al Vercel AI SDK', async () => {
  const probe = makeEngine({ stream: { deltas: ['ok'] } })
  const provider = createProvider(OPENAI_LOCAL, { engine: probe.engine })

  const result = provider.requireLanguage().stream({
    messages: [{ role: 'user', content: 'domanda' }],
    system: 'Sei un assistente giuridico.',
    tools: { cerca: { description: 'cerca', inputSchema: undefined } } as never,
    toolChoice: 'required',
    temperature: 0.2,
    maxOutputTokens: 256
  })
  await collect(result.textStream)

  assert.equal(probe.lastStreamOptions?.system, 'Sei un assistente giuridico.')
  assert.equal(probe.lastStreamOptions?.toolChoice, 'required')
  assert.equal(probe.lastStreamOptions?.temperature, 0.2)
  assert.equal(probe.lastStreamOptions?.maxOutputTokens, 256)
  assert.ok(probe.lastStreamOptions?.tools?.cerca)
})

test('generate aggrega il risultato completo', async () => {
  const probe = makeEngine({
    stream: { deltas: ['Ris', 'posta'], usage: { totalTokens: 4 } }
  })
  const provider = createProvider(OPENAI_LOCAL, { engine: probe.engine })

  const result = await provider.requireLanguage().generate({
    messages: [{ role: 'user', content: 'domanda' }]
  })

  assert.equal(result.text, 'Risposta')
  assert.equal(result.finishReason, 'stop')
})

// === Degrado controllato =====================================================

test('un guasto durante lo stream diventa ProviderError PROVIDER_UNAVAILABLE', async () => {
  const probe = makeEngine({
    stream: { deltas: ['par', 'ziale'], streamError: new Error('connessione rifiutata') }
  })
  const provider = createProvider(OPENAI_LOCAL, { engine: probe.engine })

  const result = provider.requireLanguage().stream({
    messages: [{ role: 'user', content: 'x' }]
  })

  await assert.rejects(
    () => collect(result.textStream),
    (error: unknown) => error instanceof ProviderError && error.code === 'PROVIDER_UNAVAILABLE'
  )
})

test('un errore sul testo completo diventa ProviderError PROVIDER_UNAVAILABLE', async () => {
  const probe = makeEngine({
    stream: { deltas: [], textError: new Error('timeout') }
  })
  const provider = createProvider(OPENAI_LOCAL, { engine: probe.engine })

  const result = provider.requireLanguage().stream({
    messages: [{ role: 'user', content: 'x' }]
  })

  await assert.rejects(
    () => result.text,
    (error: unknown) => error instanceof ProviderError && error.code === 'PROVIDER_UNAVAILABLE'
  )
})

// === Embedding ===============================================================

test('embed produce il vettore del testo', async () => {
  const probe = makeEngine({ embedding: [1, 2, 3] })
  const provider = createProvider(OPENAI_LOCAL, { engine: probe.engine })

  const vector = await provider.requireEmbedding().embed('testo')

  assert.deepEqual(vector, [1, 2, 3])
  assert.deepEqual(probe.embedCalls, [['testo']])
})

test('embedMany su lista vuota non chiama il provider', async () => {
  const probe = makeEngine({})
  const provider = createProvider(OPENAI_LOCAL, { engine: probe.engine })

  const vectors = await provider.requireEmbedding().embedMany([])

  assert.deepEqual(vectors, [])
  assert.deepEqual(probe.embedCalls, [])
})

test('un guasto in embedding diventa ProviderError PROVIDER_UNAVAILABLE', async () => {
  const probe = makeEngine({ embedError: new Error('endpoint spento') })
  const provider = createProvider(OPENAI_LOCAL, { engine: probe.engine })

  await assert.rejects(
    () => provider.requireEmbedding().embed('testo'),
    (error: unknown) => error instanceof ProviderError && error.code === 'PROVIDER_UNAVAILABLE'
  )
})
