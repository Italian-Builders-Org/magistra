// Confine di uscita di un job.
//
// Il runtime non conosce la destinazione dei risultati. L'indice normativo e
// di sola lettura per scelta esplicita (la scrittura e compito dell'ingest) e
// il database applicativo non e affare del worker: restare dietro
// un'interfaccia e cio che tiene il runtime indipendente da entrambi. Il sink
// reale sull'indice arrivera con il task dell'indicizzazione.

/** Destinazione dei risultati prodotti da un job. */
export interface JobSink<TOutput> {
  /**
   * Scrive il risultato di un item. Un errore qui e un guasto d'infrastruttura.
   *
   * L'implementazione deve essere idempotente per `itemId`, cioe avere
   * semantica di upsert: il runtime scrive sul sink prima di salvare il
   * checkpoint, quindi un job interrotto tra le due operazioni riscrive quello
   * stesso item alla ripresa. La consegna e «almeno una volta», e deduplicare
   * spetta alla destinazione.
   */
  write(itemId: string, output: TOutput): Promise<void>
}

/** Risultato raccolto dal sink in memoria. */
export interface ScritturaRegistrata<TOutput> {
  itemId: string
  output: TOutput
}

/** Sink in memoria: raccoglie i risultati invece di scriverli. Per i test. */
export class InMemoryJobSink<TOutput> implements JobSink<TOutput> {
  public readonly scritti: ScritturaRegistrata<TOutput>[] = []

  write(itemId: string, output: TOutput): Promise<void> {
    this.scritti.push({ itemId, output })

    return Promise.resolve()
  }
}
