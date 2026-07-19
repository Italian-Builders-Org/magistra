// Confine del motore SQL.
//
// Lo strato dati (migrazioni e repository) raggiunge il database solo
// attraverso questo contratto minimale, mai accoppiandosi al motore concreto.
// Il motore relazionale (oggi PGlite, Postgres in WASM embedded) resta isolato
// dietro l'interfaccia e sostituibile con qualunque backend Postgres-compatibile
// che sappia implementare questi tre metodi: parametri posizionali `$1, $2, ...`
// nel dialetto Postgres standard, esecuzione di script DDL multi-statement e
// transazioni.
//
// L'interfaccia e volutamente sottile: nessun query builder, nessun ORM. La
// logica di dominio non conosce il motore; i test possono iniettare un
// esecutore di prova.

/** Righe restituite da una query, gia decodificate dal motore. */
export interface SqlResult<Row> {
  rows: Row[]
}

/**
 * Esecutore di comandi SQL. Sia la connessione principale sia una transazione
 * lo implementano: il codice che gira dentro una transazione riceve lo stesso
 * contratto e non sa se sta scrivendo dentro o fuori da un blocco atomico.
 */
export interface SqlExecutor {
  /**
   * Esegue una query parametrizzata con placeholder posizionali (`$1, $2, ...`)
   * e restituisce le righe tipizzate dal chiamante.
   */
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<SqlResult<Row>>

  /**
   * Esegue uno script che puo contenere piu statement separati da `;`, senza
   * parametri. Usato per il DDL delle migrazioni.
   */
  exec(sql: string): Promise<void>
}

/** Connessione al motore: esecutore piu transazioni e chiusura delle risorse. */
export interface SqlDriver extends SqlExecutor {
  /**
   * Esegue `fn` dentro una transazione: se `fn` lancia, la transazione viene
   * annullata (rollback) e l'errore ripropagato; altrimenti viene confermata
   * (commit) e il valore restituito.
   */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>

  /** Rilascia le risorse del motore (chiude la connessione). */
  close(): Promise<void>
}
