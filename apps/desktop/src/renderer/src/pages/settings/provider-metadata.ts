import type { ProviderKind } from '@magistra/shared'

// Metadati presentazionali dei provider: solo per la UI (etichette, valori di
// esempio del model picker). Nessun segreto e nessuna logica di dominio: la
// configurazione effettiva vive nel processo main.

/** Etichetta leggibile di ciascun tipo di provider. */
export const ETICHETTE_PROVIDER: Record<ProviderKind, string> = {
  anthropic: 'Anthropic',
  google: 'Google',
  openai: 'OpenAI',
  'openai-compatible': 'Endpoint OpenAI-compatibile (locale o gateway)'
}

/** Ordine dei provider nella tendina. */
export const KIND_PROVIDER: ProviderKind[] = ['anthropic', 'openai', 'google', 'openai-compatible']

/** Il provider richiede una `base_url` (endpoint self-hosted o gateway). */
export function richiedeBaseUrl(kind: ProviderKind): boolean {
  return kind === 'openai-compatible'
}

/** Il provider offre un modello di embedding (Anthropic no). */
export function offreEmbedding(kind: ProviderKind): boolean {
  return kind !== 'anthropic'
}

/**
 * La chiave e obbligatoria (provider remoto) oppure opzionale (endpoint locale).
 * Guida solo l'etichetta del campo; il vincolo effettivo lo applica il servizio.
 */
export function chiaveObbligatoria(kind: ProviderKind): boolean {
  return kind !== 'openai-compatible'
}

/** Suggerimenti di id modello generativo, per il datalist del model picker. */
export const SUGGERIMENTI_GENERAZIONE: Record<ProviderKind, string[]> = {
  anthropic: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  'openai-compatible': ['qwen2.5', 'llama3.1', 'mistral']
}

/** Suggerimenti di id modello di embedding, per il datalist del model picker. */
export const SUGGERIMENTI_EMBEDDING: Record<ProviderKind, string[]> = {
  anthropic: [],
  openai: ['text-embedding-3-small', 'text-embedding-3-large'],
  google: ['text-embedding-004'],
  'openai-compatible': ['nomic-embed-text', 'bge-m3']
}
