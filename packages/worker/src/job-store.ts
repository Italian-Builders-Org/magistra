// Confine di persistenza di un job.
//
// Tiene due cose: il checkpoint, che permette di riprendere un job interrotto
// senza rifare il lavoro gia fatto, e la quarantena, che conserva gli item che
// l'handler non e riuscito a trattare insieme al loro input grezzo, cosi il
// problema resta ispezionabile invece di sparire in un log.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

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

/**
 * Store su filesystem.
 *
 * Il checkpoint si scrive su file temporaneo e poi si rinomina: `rename` sullo
 * stesso filesystem e atomico, quindi un processo ucciso a meta scrittura
 * lascia intatto il checkpoint precedente invece di produrne uno troncato.
 */
export class FileJobStore implements JobStore {
  private readonly rootDir: string

  constructor(rootDir: string) {
    this.rootDir = rootDir
  }

  async loadCheckpoint(jobId: string): Promise<JobCheckpoint | null> {
    try {
      const grezzo = await readFile(this.checkpointPath(jobId), 'utf8')

      return JSON.parse(grezzo) as JobCheckpoint
    } catch (error) {
      if (isErrnoCode(error, 'ENOENT')) {
        return null
      }

      throw error
    }
  }

  async saveCheckpoint(checkpoint: JobCheckpoint): Promise<void> {
    const percorso = this.checkpointPath(checkpoint.jobId)
    const temporaneo = `${percorso}.tmp`

    await mkdir(dirname(percorso), { recursive: true })
    await writeFile(temporaneo, JSON.stringify(checkpoint, null, 2), 'utf8')
    await rename(temporaneo, percorso)
  }

  async quarantine(jobId: string, entry: QuarantineEntry): Promise<void> {
    const cartella = join(this.jobDir(jobId), 'quarantena')
    // L'id di un item puo contenere separatori di percorso (un ELI, un path):
    // codificarlo lo rende un nome di file sicuro e comunque reversibile.
    const base = encodeURIComponent(entry.itemId)

    await mkdir(cartella, { recursive: true })
    await writeFile(join(cartella, `${base}.input`), serializzaInput(entry.rawInput), 'utf8')
    await writeFile(
      join(cartella, `${base}.errore.json`),
      JSON.stringify({ itemId: entry.itemId, motivo: entry.motivo }, null, 2),
      'utf8'
    )
  }

  private checkpointPath(jobId: string): string {
    return join(this.jobDir(jobId), 'checkpoint.json')
  }

  private jobDir(jobId: string): string {
    // Anche il jobId diventa un segmento di percorso: codificarlo impedisce che
    // un id contenente separatori scriva fuori dalla cartella radice.
    return join(this.rootDir, encodeURIComponent(jobId))
  }
}

/** Un input testuale si conserva com'e; il resto passa per JSON. */
function serializzaInput(rawInput: unknown): string {
  return typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput, null, 2)
}

function isErrnoCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  )
}
