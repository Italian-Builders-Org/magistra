import { streamText, embed, embedMany } from 'ai'
import type {
  EmbeddingModel,
  LanguageModel,
  LanguageModelUsage,
  ModelMessage,
  ToolChoice,
  ToolSet
} from 'ai'

import { ProviderError, asProviderUnavailable } from './errors.ts'
import type {
  GenerationRequest,
  GenerationResult,
  GenerationStream,
  GenerationToolCall,
  ProviderKind,
  TokenUsage
} from './types.ts'

// Confine tipizzato dell'astrazione dei provider.
//
// Qui vive il cuore dell'astrazione: la logica di generazione (in streaming e
// non) e di embedding, espressa una volta sola sopra il Vercel AI SDK e
// indipendente dal provider concreto. I factory in `providers/` si limitano a
// costruire i modelli dell'SDK (con chiave e `base_url`) e a passarli qui.
//
// La dipendenza dal Vercel AI SDK è isolata dietro `LlmEngine`, la fetta di SDK
// che usiamo davvero. L'implementazione predefinita instrada verso le funzioni
// reali; nei test se ne inietta una finta, così l'orchestrazione si esercita
// senza toccare la rete. È lo stesso pattern dell'indice, che inietta il
// connettore del motore vettoriale dietro un'interfaccia.

/** Una chiamata a tool grezza, come la restituisce il Vercel AI SDK. */
interface RawToolCall {
  readonly toolCallId: string
  readonly toolName: string
  readonly input: unknown
}

/** Handle di uno stream di generazione, sottoinsieme di `StreamTextResult`. */
export interface LlmStreamHandle {
  readonly textStream: AsyncIterable<string>
  readonly text: PromiseLike<string>
  readonly toolCalls: PromiseLike<readonly RawToolCall[]>
  readonly finishReason: PromiseLike<string>
  readonly usage: PromiseLike<LanguageModelUsage>
}

/** Opzioni di generazione passate all'engine, già normalizzate. */
export interface LlmEngineStreamOptions {
  readonly model: LanguageModel
  readonly messages: ModelMessage[]
  readonly system?: string
  readonly tools?: ToolSet
  readonly toolChoice?: ToolChoice<ToolSet>
  readonly temperature?: number
  readonly maxOutputTokens?: number
  readonly abortSignal?: AbortSignal
}

/**
 * La fetta del Vercel AI SDK da cui dipende l'astrazione.
 * L'implementazione reale (`defaultEngine`) instrada verso `streamText`,
 * `embed` ed `embedMany`; i test iniettano una versione controllabile.
 */
export interface LlmEngine {
  streamText(options: LlmEngineStreamOptions): LlmStreamHandle
  embed(options: {
    model: EmbeddingModel
    value: string
    abortSignal?: AbortSignal
  }): Promise<{ embedding: number[] }>
  embedMany(options: {
    model: EmbeddingModel
    values: string[]
    abortSignal?: AbortSignal
  }): Promise<{ embeddings: number[][] }>
}

/** Engine predefinito: instrada verso le funzioni reali del Vercel AI SDK. */
export const defaultEngine: LlmEngine = {
  streamText: (options) => streamText(options),
  embed: (options) => embed(options),
  embedMany: (options) => embedMany(options)
}

// === Capacità di generazione ================================================

/** La capacità di generazione di un provider (streaming e aggregata). */
export interface LanguageCapability {
  /** Identificativo del modello generativo configurato. */
  readonly modelId: string
  /**
   * Genera in streaming, esponendo i token man mano che arrivano.
   * Gli errori del provider (endpoint spento, credenziali rifiutate, timeout)
   * emergono come `ProviderError` con codice `PROVIDER_UNAVAILABLE`, sia durante
   * l'iterazione di `textStream` sia risolvendo le promesse: nessuna risposta
   * inventata, nessun ripiego su un altro provider.
   */
  stream(request: GenerationRequest): GenerationStream
  /** Genera e aggrega il risultato completo (comodità non in streaming). */
  generate(request: GenerationRequest): Promise<GenerationResult>
}

function toTokenUsage(usage: LanguageModelUsage): TokenUsage {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens
  }
}

function toToolCall(call: RawToolCall): GenerationToolCall {
  return { toolCallId: call.toolCallId, toolName: call.toolName, input: call.input }
}

/** Avvolge una promessa dell'SDK, traducendo un guasto in `ProviderError`. */
async function guard<T>(context: string, run: () => PromiseLike<T>): Promise<T> {
  try {
    return await run()
  } catch (cause) {
    if (cause instanceof ProviderError) throw cause
    throw asProviderUnavailable(context, cause)
  }
}

/**
 * Costruisce la capacità di generazione sopra un modello del Vercel AI SDK.
 * Il modello concreto (Anthropic, OpenAI, ...) arriva già configurato; qui si
 * aggiunge solo la traduzione della richiesta, lo streaming token-per-token e
 * il degrado controllato.
 */
export function buildLanguageCapability(
  model: LanguageModel,
  modelId: string,
  engine: LlmEngine = defaultEngine
): LanguageCapability {
  function open(request: GenerationRequest): LlmStreamHandle {
    // `streamText` può fallire subito (es. modello malformato): l'errore va
    // tradotto qui, prima di restituire lo stream al chiamante.
    try {
      return engine.streamText({
        model,
        messages: [...request.messages],
        system: request.system,
        tools: request.tools,
        toolChoice: request.toolChoice,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        abortSignal: request.abortSignal
      })
    } catch (cause) {
      throw asProviderUnavailable(`Generazione con il modello «${modelId}» non riuscita`, cause)
    }
  }

  function stream(request: GenerationRequest): GenerationStream {
    const handle = open(request)
    const context = `Generazione con il modello «${modelId}» non riuscita`

    async function* iterate(): AsyncGenerator<string> {
      try {
        for await (const delta of handle.textStream) {
          yield delta
        }
      } catch (cause) {
        if (cause instanceof ProviderError) throw cause
        throw asProviderUnavailable(context, cause)
      }
    }

    return {
      textStream: iterate(),
      text: guard(context, () => handle.text),
      toolCalls: guard(context, () => handle.toolCalls).then((calls) => calls.map(toToolCall)),
      finishReason: guard(context, () => handle.finishReason),
      usage: guard(context, () => handle.usage).then(toTokenUsage)
    }
  }

  async function generate(request: GenerationRequest): Promise<GenerationResult> {
    const result = stream(request)
    const [text, toolCalls, finishReason, usage] = await Promise.all([
      result.text,
      result.toolCalls,
      result.finishReason,
      result.usage
    ])
    return { text, toolCalls, finishReason, usage }
  }

  return { modelId, stream, generate }
}

// === Capacità di embedding ==================================================

/** La capacità di embedding di un provider. */
export interface EmbeddingCapability {
  /** Identificativo del modello di embedding configurato. */
  readonly modelId: string
  /** Produce l'embedding di un testo. */
  embed(text: string): Promise<number[]>
  /** Produce gli embedding di più testi, nello stesso ordine dell'input. */
  embedMany(texts: readonly string[]): Promise<number[][]>
}

/** Costruisce la capacità di embedding sopra un modello del Vercel AI SDK. */
export function buildEmbeddingCapability(
  model: EmbeddingModel,
  modelId: string,
  engine: LlmEngine = defaultEngine
): EmbeddingCapability {
  const context = `Embedding con il modello «${modelId}» non riuscito`

  async function embedOne(text: string): Promise<number[]> {
    const { embedding } = await guard(context, () => engine.embed({ model, value: text }))
    return embedding
  }

  async function embedManyTexts(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const { embeddings } = await guard(context, () =>
      engine.embedMany({ model, values: [...texts] })
    )
    return embeddings
  }

  return { modelId, embed: embedOne, embedMany: embedManyTexts }
}

// === Il provider ============================================================

/** Descrive il provider configurato, senza esporne i segreti. */
export interface ProviderDescriptor {
  readonly kind: ProviderKind
  /** Etichetta leggibile del provider. */
  readonly label: string
  /** Modello generativo configurato, o `null` se assente. */
  readonly generationModelId: string | null
  /** Modello di embedding configurato, o `null` se assente. */
  readonly embeddingModelId: string | null
  /** Base URL dell'endpoint, o `null` per i provider nativi senza override. */
  readonly baseUrl: string | null
}

/**
 * Un provider LLM configurato, dietro l'unica astrazione multi-provider.
 * Espone le capacità effettivamente configurate; una capacità assente è `null`.
 * `requireLanguage`/`requireEmbedding` sono la via del degrado controllato per
 * chi ha bisogno di una capacità: sollevano `UNSUPPORTED_CAPABILITY` con un
 * messaggio chiaro invece di far dereferenziare un `null`.
 */
export interface LlmProvider {
  readonly descriptor: ProviderDescriptor
  readonly language: LanguageCapability | null
  readonly embedding: EmbeddingCapability | null
  requireLanguage(): LanguageCapability
  requireEmbedding(): EmbeddingCapability
}

/** Assembla un `LlmProvider` da descrittore e capacità. */
export function createLlmProvider(parts: {
  descriptor: ProviderDescriptor
  language: LanguageCapability | null
  embedding: EmbeddingCapability | null
}): LlmProvider {
  const { descriptor, language, embedding } = parts

  return {
    descriptor,
    language,
    embedding,
    requireLanguage() {
      if (!language) {
        throw new ProviderError(
          `Il provider «${descriptor.label}» non ha un modello generativo configurato.`,
          'UNSUPPORTED_CAPABILITY'
        )
      }
      return language
    },
    requireEmbedding() {
      if (!embedding) {
        throw new ProviderError(
          `Il provider «${descriptor.label}» non ha un modello di embedding configurato.`,
          'UNSUPPORTED_CAPABILITY'
        )
      }
      return embedding
    }
  }
}
