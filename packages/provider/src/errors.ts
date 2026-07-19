// Errori del provider LLM.
//
// Un solo tipo con un `code` discriminante, sullo stesso modello di
// `IndexError` dell'indice e di `DocumentConversionError` del worker: chi
// consuma l'astrazione distingue i casi (configurazione errata, provider
// irraggiungibile, capacità non offerta) senza affidarsi al testo del
// messaggio.
//
// Questi codici sono il perno del «degrado controllato» descritto nella base
// di conoscenza: quando qualcosa non va, l'astrazione solleva un errore chiaro
// e non inventa una risposta. In particolare non esiste da nessuna parte una
// logica che, di fronte a un errore, ripieghi in silenzio su un altro
// provider: cambiare provider altera privacy, costo e qualità e resta una
// scelta esplicita dell'utente.

export type ProviderErrorCode =
  // La configurazione del provider non è valida (modello mancante, `base_url`
  // assente per l'endpoint OpenAI-compatibile, chiave richiesta ma assente).
  | 'INVALID_CONFIG'
  // È stata richiesta una capacità che il provider configurato non offre (ad
  // esempio l'embedding su Anthropic, oppure la generazione quando è stato
  // configurato solo il modello di embedding).
  | 'UNSUPPORTED_CAPABILITY'
  // Il provider non ha risposto o ha risposto con un errore (endpoint spento,
  // rete assente, credenziali rifiutate, timeout): è il caso di degrado in cui
  // l'app deve fermarsi con un messaggio chiaro, senza risposte inventate.
  | 'PROVIDER_UNAVAILABLE'

/**
 * Errore di dominio dell'astrazione dei provider, con un codice stabile.
 * Il `code` è pensato per essere ispezionato dal chiamante; il `message` è per
 * l'utente e non va usato per discriminare i casi.
 */
export class ProviderError extends Error {
  public readonly code: ProviderErrorCode

  constructor(message: string, code: ProviderErrorCode, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProviderError'
    this.code = code
  }
}

/**
 * Avvolge un errore qualunque (quasi sempre proveniente dal Vercel AI SDK o
 * dallo strato di rete) in un `ProviderError` con codice `PROVIDER_UNAVAILABLE`,
 * conservando la causa originale.
 * È il punto in cui un guasto del trasporto diventa il degrado controllato che
 * la UI può mostrare all'utente.
 */
export function asProviderUnavailable(context: string, cause: unknown): ProviderError {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new ProviderError(`${context}: ${detail}`, 'PROVIDER_UNAVAILABLE', { cause })
}
