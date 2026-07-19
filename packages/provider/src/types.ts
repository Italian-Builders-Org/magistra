import { z } from 'zod'
import type { ModelMessage, ToolSet } from 'ai'

// Tipi e contratti dell'astrazione dei provider.
//
// I messaggi e i tool viaggiano al confine nella forma del Vercel AI SDK
// (`ModelMessage`, `ToolSet`): l'astrazione è implementata con quell'SDK, quindi
// riusarne i tipi al confine evita di reinventare e ridurre a mano un modello
// di messaggi già ricco (testo, immagini, chiamate a tool). Il core costruisce
// i `ModelMessage` e li passa senza conoscere il provider concreto.

/** Rende esplicito che al confine si usano i messaggi del Vercel AI SDK. */
export type ProviderMessage = ModelMessage

/** Insieme di tool esposti al modello, nella forma del Vercel AI SDK. */
export type ProviderToolSet = ToolSet

// === Configurazione dei provider ============================================
//
// Lo schema è la fonte di verità sia dei tipi sia della validazione a runtime.
// Un'unione discriminata su `kind` copre i tre provider remoti di prima classe
// più il caso generico OpenAI-compatibile (`base_url` obbligatorio, chiave
// opzionale perché un runtime locale spesso non la richiede).

/** I provider supportati al lancio. */
export const providerKindSchema = z.enum(['anthropic', 'google', 'openai', 'openai-compatible'])

/** Tipo di provider. */
export type ProviderKind = z.infer<typeof providerKindSchema>

const nonEmpty = z.string().trim().min(1)

/**
 * Anthropic: provider nativo del Vercel AI SDK per la famiglia Claude.
 * Offre solo la generazione; non espone un modello di embedding.
 */
export const anthropicConfigSchema = z.object({
  kind: z.literal('anthropic'),
  apiKey: nonEmpty,
  generationModel: nonEmpty,
  /** Override del base URL, per un gateway compatibile con l'API Anthropic. */
  baseUrl: z.string().url().optional()
})

/** OpenAI: generazione e/o embedding, entrambi nativi. */
export const openaiConfigSchema = z.object({
  kind: z.literal('openai'),
  apiKey: nonEmpty,
  generationModel: nonEmpty.optional(),
  embeddingModel: nonEmpty.optional(),
  baseUrl: z.string().url().optional()
})

/** Google: generazione e/o embedding con la famiglia Gemini. */
export const googleConfigSchema = z.object({
  kind: z.literal('google'),
  apiKey: nonEmpty,
  generationModel: nonEmpty.optional(),
  embeddingModel: nonEmpty.optional(),
  baseUrl: z.string().url().optional()
})

/**
 * Endpoint generico OpenAI-compatibile: copre i gateway remoti (es. OpenRouter)
 * e soprattutto i runtime self-hosted (Ollama, LM Studio, llama.cpp) su
 * `localhost` o sulla rete dello studio.
 * `baseUrl` è obbligatorio; la chiave è opzionale perché un runtime locale
 * spesso non la richiede.
 */
export const openaiCompatibleConfigSchema = z.object({
  kind: z.literal('openai-compatible'),
  /** Indirizzo dell'endpoint, ad esempio `http://localhost:11434/v1`. */
  baseUrl: z.string().url(),
  apiKey: nonEmpty.optional(),
  /** Nome del provider, usato dall'SDK per etichettare le richieste. */
  name: nonEmpty.optional(),
  generationModel: nonEmpty.optional(),
  embeddingModel: nonEmpty.optional(),
  /** Header aggiuntivi, per l'autenticazione di un server sulla rete dello studio. */
  headers: z.record(z.string()).optional()
})

/**
 * Configurazione di un provider, discriminata su `kind`.
 * Il controllo «almeno un modello configurato» è a livello di unione perché
 * `discriminatedUnion` accetta solo oggetti semplici, non schemi con refine.
 * Anthropic ha già `generationModel` obbligatorio nello schema, quindi supera
 * sempre il controllo.
 */
export const providerConfigSchema = z
  .discriminatedUnion('kind', [
    anthropicConfigSchema,
    openaiConfigSchema,
    googleConfigSchema,
    openaiCompatibleConfigSchema
  ])
  .superRefine((config, ctx) => {
    const generationModel = 'generationModel' in config ? config.generationModel : undefined
    const embeddingModel = 'embeddingModel' in config ? config.embeddingModel : undefined
    if (!generationModel && !embeddingModel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Configura almeno un modello: generativo, di embedding, o entrambi.'
      })
    }
  })

/** Configurazione di un provider. */
export type ProviderConfig = z.infer<typeof providerConfigSchema>

// === Richieste e risultati di generazione ===================================

/**
 * Scelta di tool imposta al modello.
 * `auto` (default) lascia decidere il modello, `none` la disabilita, `required`
 * obbliga a chiamarne uno, oppure si forza un tool specifico per nome.
 */
export type GenerationToolChoice =
  'auto' | 'none' | 'required' | { readonly type: 'tool'; readonly toolName: string }

/** Richiesta di generazione, indipendente dal provider concreto. */
export interface GenerationRequest {
  /** Messaggi della conversazione, nel formato del Vercel AI SDK. */
  readonly messages: readonly ProviderMessage[]
  /** Istruzione di sistema, se non già presente tra i messaggi. */
  readonly system?: string
  /** Tool a disposizione del modello. */
  readonly tools?: ProviderToolSet
  /** Vincolo sull'uso dei tool. */
  readonly toolChoice?: GenerationToolChoice
  /** Temperatura di campionamento. */
  readonly temperature?: number
  /** Tetto ai token generati. */
  readonly maxOutputTokens?: number
  /** Segnale per annullare la richiesta. */
  readonly abortSignal?: AbortSignal
}

/** Uso di token riportato dal provider (i campi possono mancare). */
export interface TokenUsage {
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly totalTokens?: number
}

/** Una chiamata a tool prodotta dal modello. */
export interface GenerationToolCall {
  readonly toolCallId: string
  readonly toolName: string
  /** Argomenti della chiamata, conformi allo schema del tool. */
  readonly input: unknown
}

/** Risultato aggregato di una generazione non in streaming. */
export interface GenerationResult {
  readonly text: string
  readonly toolCalls: readonly GenerationToolCall[]
  readonly finishReason: string
  readonly usage: TokenUsage
}

/**
 * Risultato di una generazione in streaming.
 * `textStream` emette i delta di testo token-per-token, così il backend può
 * inoltrarli alla UI man mano che arrivano; le promesse si risolvono al termine
 * dello stream con il testo completo e i metadati.
 */
export interface GenerationStream {
  /** Delta di testo, token-per-token. */
  readonly textStream: AsyncIterable<string>
  /** Testo completo, disponibile al termine dello stream. */
  readonly text: Promise<string>
  /** Chiamate a tool prodotte dal modello. */
  readonly toolCalls: Promise<readonly GenerationToolCall[]>
  /** Motivo di terminazione riportato dal provider. */
  readonly finishReason: Promise<string>
  /** Uso di token, al termine dello stream. */
  readonly usage: Promise<TokenUsage>
}
