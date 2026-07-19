import type { EmbedderIdentity } from './manifest.ts'

// Errori dell'indice.
//
// Un solo tipo con un `code` discriminante, sullo stesso modello di
// `DocumentConversionError` del worker: chi consuma l'interfaccia distingue i
// casi (manifest assente, embedder incompatibile, filtro malformato) senza
// affidarsi al testo del messaggio.

export type IndexErrorCode =
  | 'MANIFEST_NOT_FOUND'
  | 'MANIFEST_INVALID'
  | 'INCOMPATIBLE_EMBEDDER'
  | 'TABLE_NOT_FOUND'
  | 'INVALID_FILTER'
  | 'INVALID_QUERY_VECTOR'
  | 'MALFORMED_ROW'

export class IndexError extends Error {
  public readonly code: IndexErrorCode

  constructor(message: string, code: IndexErrorCode, options?: ErrorOptions) {
    super(message, options)
    this.name = 'IndexError'
    this.code = code
  }
}

/**
 * Sollevato quando il manifest dell'indice dichiara un embedder diverso da
 * quello con cui l'app produce le query: i vettori non sono confrontabili e la
 * ricerca va rifiutata prima di eseguirla.
 */
export class IncompatibleEmbedderError extends IndexError {
  public readonly expected: EmbedderIdentity
  public readonly actual: EmbedderIdentity

  constructor(expected: EmbedderIdentity, actual: EmbedderIdentity) {
    super(
      `Indice incompatibile: atteso embedder ${formatEmbedder(expected)}, ` +
        `il manifest dichiara ${formatEmbedder(actual)}.`,
      'INCOMPATIBLE_EMBEDDER'
    )
    this.name = 'IncompatibleEmbedderError'
    this.expected = expected
    this.actual = actual
  }
}

function formatEmbedder(embedder: EmbedderIdentity): string {
  return `${embedder.nome}@${embedder.versione} (${embedder.dimensioni}d)`
}
