import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogle } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { EmbeddingModel, LanguageModel } from 'ai'

import { ProviderError } from './errors.ts'
import {
  buildEmbeddingCapability,
  buildLanguageCapability,
  createLlmProvider,
  defaultEngine,
  type EmbeddingCapability,
  type LanguageCapability,
  type LlmEngine,
  type LlmProvider,
  type ProviderDescriptor
} from './interface.ts'
import { providerConfigSchema, type ProviderConfig } from './types.ts'

// Factory dei provider.
//
// Ogni factory istanzia i modelli concreti del Vercel AI SDK a partire dalla
// configurazione (chiave e/o `base_url`) e li consegna ai costruttori di
// capacità del confine tipizzato. Tutta la logica di generazione ed embedding
// vive lì: qui si fa solo il cablaggio dei provider nativi e del caso generico
// OpenAI-compatibile.
//
// Non c'è alcuna logica di ripiego: `createProvider` costruisce esattamente il
// provider descritto dalla configurazione. Cambiare provider è una scelta
// esplicita dell'utente nelle impostazioni, non una decisione automatica di
// fronte a un errore.

/** Dipendenze iniettabili, per esercitare l'orchestrazione senza rete nei test. */
export interface ProviderDeps {
  /** La fetta di Vercel AI SDK usata per generazione ed embedding. */
  readonly engine?: LlmEngine
}

/** Etichetta leggibile del provider, per messaggi e UI. */
function describeLabel(config: ProviderConfig): string {
  switch (config.kind) {
    case 'anthropic':
      return 'Anthropic'
    case 'google':
      return 'Google'
    case 'openai':
      return 'OpenAI'
    case 'openai-compatible':
      return config.name ?? 'Endpoint OpenAI-compatibile'
  }
}

/** Costruisce i modelli generativo e di embedding a partire dalla configurazione. */
function resolveModels(config: ProviderConfig): {
  language: { model: LanguageModel; modelId: string } | null
  embedding: { model: EmbeddingModel; modelId: string } | null
} {
  switch (config.kind) {
    case 'anthropic': {
      // Anthropic offre solo la generazione; non espone un modello di embedding.
      const provider = createAnthropic({ apiKey: config.apiKey, baseURL: config.baseUrl })
      return {
        language: {
          model: provider.languageModel(config.generationModel),
          modelId: config.generationModel
        },
        embedding: null
      }
    }
    case 'openai': {
      const provider = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })
      return {
        language: config.generationModel
          ? {
              model: provider.languageModel(config.generationModel),
              modelId: config.generationModel
            }
          : null,
        embedding: config.embeddingModel
          ? {
              model: provider.embeddingModel(config.embeddingModel),
              modelId: config.embeddingModel
            }
          : null
      }
    }
    case 'google': {
      const provider = createGoogle({ apiKey: config.apiKey, baseURL: config.baseUrl })
      return {
        language: config.generationModel
          ? {
              model: provider.languageModel(config.generationModel),
              modelId: config.generationModel
            }
          : null,
        embedding: config.embeddingModel
          ? {
              model: provider.embeddingModel(config.embeddingModel),
              modelId: config.embeddingModel
            }
          : null
      }
    }
    case 'openai-compatible': {
      // Copre i runtime locali (Ollama, LM Studio, llama.cpp) e i gateway
      // remoti: stessa API, raggiunta via `base_url` con chiave opzionale.
      const provider = createOpenAICompatible({
        name: config.name ?? 'openai-compatible',
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        headers: config.headers
      })
      return {
        language: config.generationModel
          ? {
              model: provider.languageModel(config.generationModel),
              modelId: config.generationModel
            }
          : null,
        embedding: config.embeddingModel
          ? {
              model: provider.embeddingModel(config.embeddingModel),
              modelId: config.embeddingModel
            }
          : null
      }
    }
  }
}

/**
 * Crea un provider LLM dalla configurazione, dietro l'unica astrazione
 * multi-provider.
 * Valida la configurazione con lo schema Zod: se non è valida solleva
 * `ProviderError` con codice `INVALID_CONFIG`, senza costruire nulla a metà.
 *
 * @throws {ProviderError} `INVALID_CONFIG` se la configurazione non è valida.
 */
export function createProvider(config: unknown, deps: ProviderDeps = {}): LlmProvider {
  const parsed = providerConfigSchema.safeParse(config)
  if (!parsed.success) {
    throw new ProviderError(
      `Configurazione del provider non valida: ${parsed.error.message}`,
      'INVALID_CONFIG',
      { cause: parsed.error }
    )
  }

  const validConfig = parsed.data
  const engine = deps.engine ?? defaultEngine
  const models = resolveModels(validConfig)

  const language: LanguageCapability | null = models.language
    ? buildLanguageCapability(models.language.model, models.language.modelId, engine)
    : null
  const embedding: EmbeddingCapability | null = models.embedding
    ? buildEmbeddingCapability(models.embedding.model, models.embedding.modelId, engine)
    : null

  const descriptor: ProviderDescriptor = {
    kind: validConfig.kind,
    label: describeLabel(validConfig),
    generationModelId: models.language?.modelId ?? null,
    embeddingModelId: models.embedding?.modelId ?? null,
    baseUrl: 'baseUrl' in validConfig ? (validConfig.baseUrl ?? null) : null
  }

  return createLlmProvider({ descriptor, language, embedding })
}
