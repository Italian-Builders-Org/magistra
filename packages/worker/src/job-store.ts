// Confine di persistenza di un job.
//
// Tiene due cose: il checkpoint, che permette di riprendere un job interrotto
// senza rifare il lavoro gia fatto, e la quarantena, che conserva gli item che
// l'handler non e riuscito a trattare insieme al loro input grezzo, cosi il
// problema resta ispezionabile invece di sparire in un log.

/** Esito registrato per un item gia elaborato. */
export type ItemEsitoRegistrato = 'ok' | 'parziale' | 'quarantena'

/** Voce di quarantena: l'input grezzo e il motivo per cui e finito qui. */
export interface QuarantineEntry {
  itemId: string
  /** Input dell'item, preservato com'era: e il materiale per capire il guasto. */
  rawInput: unknown
  /** Messaggio dell'errore che ha causato la quarantena. */
  motivo: string
}

/** Stato persistito di un job, sufficiente a riprenderlo. */
export interface JobCheckpoint {
  jobId: string
  tipo: string
  /**
   * Id degli item gia elaborati con il loro esito. La quarantena conta come
   * elaborata: un item velenoso non va ritentato a ogni ripresa.
   */
  esiti: Record<string, ItemEsitoRegistrato>
}

/** Persistenza dello stato di un job. */
export interface JobStore {
  loadCheckpoint(jobId: string): Promise<JobCheckpoint | null>
  saveCheckpoint(checkpoint: JobCheckpoint): Promise<void>
  quarantine(jobId: string, entry: QuarantineEntry): Promise<void>
}

/** Store in memoria: nessun file, tutto volatile. Per i test. */
export class InMemoryJobStore implements JobStore {
  public readonly quarantena: QuarantineEntry[] = []
  public salvataggi = 0
  private readonly checkpoints = new Map<string, JobCheckpoint>()

  loadCheckpoint(jobId: string): Promise<JobCheckpoint | null> {
    const checkpoint = this.checkpoints.get(jobId)

    return Promise.resolve(checkpoint ? { ...checkpoint, esiti: { ...checkpoint.esiti } } : null)
  }

  saveCheckpoint(checkpoint: JobCheckpoint): Promise<void> {
    this.salvataggi += 1
    // Copia difensiva: il runtime muta il proprio registro a ogni item, e un
    // riferimento condiviso farebbe sembrare persistito cio che non lo e.
    this.checkpoints.set(checkpoint.jobId, { ...checkpoint, esiti: { ...checkpoint.esiti } })

    return Promise.resolve()
  }

  quarantine(_jobId: string, entry: QuarantineEntry): Promise<void> {
    this.quarantena.push(entry)

    return Promise.resolve()
  }
}
