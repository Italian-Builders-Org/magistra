// Errori dello strato dati.
//
// Un solo tipo con un `code` discriminante, sullo stesso modello di
// `IndexError` dell'indice e di `DocumentConversionError` del worker: chi
// consuma l'interfaccia distingue i casi (violazione di vincolo, riga
// malformata, migrazione fallita) senza affidarsi al testo del messaggio, che
// puo dipendere dal motore concreto.

export type DataErrorCode =
  // Una migrazione ha fallito durante l'applicazione dello schema.
  | 'MIGRATION_FAILED'
  // La sequenza delle migrazioni non e coerente (versioni duplicate, buchi,
  // versione applicata sconosciuta): lo schema su disco non e riproducibile.
  | 'MIGRATION_INCONSISTENT'
  // Violazione di un vincolo di unicita (es. (conversazione_id, ordine)).
  | 'UNIQUE_VIOLATION'
  // Violazione di una chiave esterna (es. documento su un progetto assente).
  | 'FOREIGN_KEY_VIOLATION'
  // Una riga restituita dal motore non ha la forma attesa.
  | 'MALFORMED_ROW'
  // Input non valido per un'operazione dello strato dati.
  | 'INVALID_INPUT'

export class DataError extends Error {
  public readonly code: DataErrorCode

  constructor(message: string, code: DataErrorCode, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DataError'
    this.code = code
  }
}
