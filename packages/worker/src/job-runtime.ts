import type { JobProgress, JobSummary } from '@magistra/shared'

import type { JobSink } from './job-sink.js'
import type { ItemEsitoRegistrato, JobCheckpoint, JobStore } from './job-store.js'

// Runtime dei job batch.
//
// Esegue un job su una sequenza di item isolando ogni item dagli altri. La
// garanzia che conta e questa: un handler che esplode su un input malformato
// manda quell'item in quarantena e il job prosegue, invece di abbattere il
// processo. Vedi knowledge/architettura/worker-ingest.md.
//
// Il runtime non sa nulla del dominio: gli stage reali dell'ingest (parsing,
// chunking, embedding) si agganciano qui come handler tipizzati.

/** Un'unita di lavoro del job, con un id stabile tra un'esecuzione e l'altra. */
export interface JobItem<TInput> {
  id: string
  input: TInput
}

/**
 * Esito di un item trattato con successo. L'handler segnala «parziale» quando
 * ha prodotto un risultato utilizzabile ma incompleto; per dire «non ce l'ho
 * fatta» lancia, e il runtime mette l'item in quarantena.
 */
export type ItemOutcome<TOutput> =
  { esito: 'ok'; output: TOutput } | { esito: 'parziale'; output: TOutput; note: string[] }

/** Logica di dominio applicata a un singolo item. Lanciare significa quarantena. */
export type JobHandler<TInput, TOutput> = (item: JobItem<TInput>) => Promise<ItemOutcome<TOutput>>

/**
 * Descrizione di un job da eseguire.
 *
 * `items` e un iterabile, sincrono o asincrono: un array lo soddisfa senza
 * involucri, e quando l'ingest reale portera una sorgente in streaming il
 * contratto non cambiera. `totale` e noto solo per le sorgenti finite.
 */
export interface JobDescriptor<TInput> {
  jobId: string
  tipo: string
  items: AsyncIterable<JobItem<TInput>> | Iterable<JobItem<TInput>>
  totale?: number
}

/** Causa di un guasto d'infrastruttura che interrompe il job. */
export type JobErrorCode = 'SINK_FALLITO' | 'QUARANTENA_FALLITA' | 'CHECKPOINT_FALLITO'

/**
 * Guasto d'infrastruttura: disco pieno, destinazione non scrivibile.
 * E distinto da un input malformato, che invece finisce in quarantena.
 */
export class JobError extends Error {
  public readonly code: JobErrorCode

  constructor(message: string, code: JobErrorCode, options?: ErrorOptions) {
    super(message, options)
    this.name = 'JobError'
    this.code = code
  }
}

/** Confini iniettati e osservazione dell'avanzamento. */
export interface RunJobOptions<TOutput> {
  store: JobStore
  sink: JobSink<TOutput>
  onProgress?: (progress: JobProgress) => void
}

/**
 * Esegue un job item per item.
 *
 * Riprende da un checkpoint esistente saltando gli item gia elaborati; isola
 * ogni handler, instradando in quarantena chi lancia; salva il checkpoint ed
 * emette l'avanzamento dopo ogni item.
 *
 * La scrittura sul sink precede il salvataggio del checkpoint: un job ucciso
 * tra le due riscrive quell'item alla ripresa, quindi il sink deve essere
 * idempotente per `itemId` (semantica di upsert). E la scelta deliberata: mai
 * perdere un risultato, al prezzo di poterlo riscrivere.
 *
 * @throws {JobError} se store o sink falliscono: e un guasto d'infrastruttura,
 *   e proseguire non avrebbe senso perche ogni item successivo lo incontrerebbe
 *   di nuovo. Il checkpoint gia scritto permette comunque la ripresa.
 */
export async function runJob<TInput, TOutput>(
  descriptor: JobDescriptor<TInput>,
  handler: JobHandler<TInput, TOutput>,
  options: RunJobOptions<TOutput>
): Promise<JobSummary> {
  const { store, sink, onProgress } = options
  const { jobId, tipo } = descriptor
  const totale = descriptor.totale ?? null

  let precedente: JobCheckpoint | null
  try {
    precedente = await store.loadCheckpoint(jobId)
  } catch (error) {
    throw new JobError(
      `Lettura del checkpoint fallita per il job ${jobId}.`,
      'CHECKPOINT_FALLITO',
      {
        cause: error
      }
    )
  }

  const esiti: Record<string, ItemEsitoRegistrato> = { ...(precedente?.esiti ?? {}) }

  let ok = 0
  let parziali = 0
  let inQuarantena = 0

  for (const esito of Object.values(esiti)) {
    if (esito === 'ok') {
      ok += 1
    } else if (esito === 'parziale') {
      parziali += 1
    } else {
      inQuarantena += 1
    }
  }

  for await (const item of descriptor.items) {
    if (esiti[item.id]) {
      continue
    }

    let esitoItem: ItemOutcome<TOutput> | undefined
    let causa: unknown
    let fallito = false

    try {
      esitoItem = await handler(item)
    } catch (error) {
      causa = error
      fallito = true
    }

    if (!fallito && esitoItem !== undefined) {
      try {
        await sink.write(item.id, esitoItem.output)
      } catch (error) {
        throw new JobError(
          `Scrittura del risultato fallita per l'item ${item.id}.`,
          'SINK_FALLITO',
          { cause: error }
        )
      }

      esiti[item.id] = esitoItem.esito

      if (esitoItem.esito === 'ok') {
        ok += 1
      } else {
        parziali += 1
      }
    } else {
      // Il motivo della quarantena esiste per essere letto da chi indaga: se
      // l'handler non ha lanciato ma non ha nemmeno prodotto un esito, dirlo e
      // meglio che registrare un messaggio vuoto.
      const motivo = fallito ? messaggioDi(causa) : "L'handler non ha restituito alcun esito."

      try {
        await store.quarantine(jobId, {
          itemId: item.id,
          rawInput: item.input,
          motivo
        })
      } catch (error) {
        throw new JobError(
          `Quarantena fallita per l'item ${item.id} (causa originale: ${motivo}).`,
          'QUARANTENA_FALLITA',
          { cause: error }
        )
      }

      esiti[item.id] = 'quarantena'
      inQuarantena += 1
    }

    try {
      await store.saveCheckpoint({ jobId, tipo, esiti })
    } catch (error) {
      throw new JobError(
        `Salvataggio del checkpoint fallito dopo l'item ${item.id}.`,
        'CHECKPOINT_FALLITO',
        { cause: error }
      )
    }

    onProgress?.({
      jobId,
      tipo,
      elaborati: ok + parziali + inQuarantena,
      ok,
      parziali,
      inQuarantena,
      totale
    })
  }

  return {
    jobId,
    tipo,
    stato: inQuarantena > 0 ? 'completato_con_quarantena' : 'completato',
    elaborati: ok + parziali + inQuarantena,
    ok,
    parziali,
    inQuarantena,
    totale
  }
}

function messaggioDi(causa: unknown): string {
  if (causa instanceof Error) {
    return causa.message
  }

  // `String(null)` da «null», che non dice nulla a chi legge la quarantena:
  // meglio conservare anche il tipo di cio che l'handler ha lanciato.
  return `valore non-Error lanciato dall'handler: ${typeof causa} ${String(causa)}`
}
