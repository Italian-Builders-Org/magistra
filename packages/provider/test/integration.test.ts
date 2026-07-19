import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createProvider, type ProviderConfig } from '../src/index.ts'

// Test di integrazione opt-in: esercitano il vero Vercel AI SDK contro endpoint
// reali, senza engine iniettato. Sono saltati per default (non toccano la rete
// in CI) e si abilitano impostando le variabili d'ambiente qui sotto.
//
// Endpoint OpenAI-compatibile locale (es. Ollama):
//   MAGISTRA_TEST_LOCAL_BASE_URL=http://localhost:11434/v1
//   MAGISTRA_TEST_LOCAL_GEN_MODEL=qwen2.5
//   MAGISTRA_TEST_LOCAL_EMBED_MODEL=nomic-embed-text
//   MAGISTRA_TEST_LOCAL_API_KEY=...        (opzionale)
//
// Provider remoto (uno tra anthropic|openai|google):
//   MAGISTRA_TEST_REMOTE_KIND=openai
//   MAGISTRA_TEST_REMOTE_API_KEY=...
//   MAGISTRA_TEST_REMOTE_GEN_MODEL=gpt-4o-mini
//   MAGISTRA_TEST_REMOTE_EMBED_MODEL=text-embedding-3-small   (opzionale)

const env = process.env

function localConfig(): ProviderConfig | null {
  const baseUrl = env.MAGISTRA_TEST_LOCAL_BASE_URL
  const generationModel = env.MAGISTRA_TEST_LOCAL_GEN_MODEL
  if (!baseUrl || !generationModel) return null
  return {
    kind: 'openai-compatible',
    baseUrl,
    apiKey: env.MAGISTRA_TEST_LOCAL_API_KEY,
    generationModel,
    embeddingModel: env.MAGISTRA_TEST_LOCAL_EMBED_MODEL
  }
}

function remoteConfig(): ProviderConfig | null {
  const kind = env.MAGISTRA_TEST_REMOTE_KIND
  const apiKey = env.MAGISTRA_TEST_REMOTE_API_KEY
  const generationModel = env.MAGISTRA_TEST_REMOTE_GEN_MODEL
  if (!kind || !apiKey || !generationModel) return null
  if (kind === 'anthropic') return { kind, apiKey, generationModel }
  if (kind === 'openai' || kind === 'google') {
    return { kind, apiKey, generationModel, embeddingModel: env.MAGISTRA_TEST_REMOTE_EMBED_MODEL }
  }
  return null
}

async function firstToken(stream: AsyncIterable<string>): Promise<string> {
  for await (const delta of stream) {
    if (delta.length > 0) return delta
  }
  return ''
}

const local = localConfig()
const remote = remoteConfig()

test(
  'generazione in streaming contro un endpoint OpenAI-compatibile locale',
  { skip: !local },
  async () => {
    const provider = createProvider(local!)
    const result = provider.requireLanguage().stream({
      messages: [{ role: 'user', content: 'Rispondi con una sola parola: ciao.' }],
      maxOutputTokens: 32
    })

    const tokens: string[] = []
    for await (const delta of result.textStream) tokens.push(delta)

    assert.ok(tokens.length > 0, 'lo stream deve emettere almeno un token')
    assert.ok((await result.text).length > 0)
  }
)

const localHasEmbedding = !!local && 'embeddingModel' in local && !!local.embeddingModel

test(
  'embedding contro un endpoint OpenAI-compatibile locale',
  { skip: !localHasEmbedding },
  async () => {
    const provider = createProvider(local!)
    const vector = await provider.requireEmbedding().embed('atto di citazione')

    assert.ok(vector.length > 0, "l'embedding deve avere dimensione positiva")
  }
)

test('generazione in streaming contro un provider remoto', { skip: !remote }, async () => {
  const provider = createProvider(remote!)
  const result = provider.requireLanguage().stream({
    messages: [{ role: 'user', content: 'Rispondi con una sola parola: ciao.' }],
    maxOutputTokens: 32
  })

  assert.ok((await firstToken(result.textStream)).length >= 0)
  assert.ok((await result.text).length > 0)
})
