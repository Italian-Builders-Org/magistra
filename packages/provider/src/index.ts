// Pacchetto dell'astrazione dei provider LLM.
//
// Un'unica astrazione multi-provider, implementata con il Vercel AI SDK, per
// generazione (in streaming, con tool calling) ed embedding verso Anthropic,
// Google, OpenAI e qualunque endpoint OpenAI-compatibile, inclusi i runtime
// locali. Il core di orchestrazione importa da qui e resta indipendente dal
// provider concreto: cambiare provider o modello non tocca la pipeline RAG.
//
// Degrado controllato: se il provider non è disponibile l'astrazione solleva un
// errore chiaro (`ProviderError`), senza risposte inventate e senza ripiego
// silenzioso su un altro provider.

export { ProviderError, asProviderUnavailable, type ProviderErrorCode } from './errors.ts'

export {
  providerKindSchema,
  providerConfigSchema,
  anthropicConfigSchema,
  openaiConfigSchema,
  googleConfigSchema,
  openaiCompatibleConfigSchema,
  type ProviderKind,
  type ProviderConfig,
  type ProviderMessage,
  type ProviderToolSet,
  type GenerationRequest,
  type GenerationResult,
  type GenerationStream,
  type GenerationToolCall,
  type GenerationToolChoice,
  type TokenUsage
} from './types.ts'

export {
  buildLanguageCapability,
  buildEmbeddingCapability,
  createLlmProvider,
  defaultEngine,
  type LlmProvider,
  type ProviderDescriptor,
  type LanguageCapability,
  type EmbeddingCapability,
  type LlmEngine,
  type LlmEngineStreamOptions,
  type LlmStreamHandle
} from './interface.ts'

export { createProvider, type ProviderDeps } from './factory.ts'

// Helper del Vercel AI SDK per definire un tool (descrizione, schema, esecuzione),
// ri-esportato così il core costruisce i tool senza importare direttamente l'SDK.
export { tool } from 'ai'
