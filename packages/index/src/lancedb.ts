import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import * as lancedb from '@lancedb/lancedb'

import { IndexError } from './errors.ts'
import { INDEX_MANIFEST_FILE_NAME, type EmbedderIdentity } from './manifest.ts'
import {
  openNormativeIndex,
  type IndexConnector,
  type IndexSearchParams,
  type IndexSearchRow,
  type IndexTable,
  type NormativeIndex
} from './interface.ts'

// Implementazione LanceDB dell'interfaccia dell'indice.
//
// LanceDB è un motore vettoriale embedded nativo (binari Rust precompilati
// cross-platform): gira in-process nell'app desktop, senza servizi esterni, e
// applica il prefiltro per metadato dentro il motore prima della ricerca ANN.
// Qui l'accesso è di sola lettura: si apre una tabella esistente e si
// interroga, senza mai scrivere (l'indicizzazione è compito dell'ingest).

/** Colonna con cui LanceDB annota la distanza nei risultati della ricerca. */
const DISTANCE_COLUMN = '_distance'

/** Handle LanceDB di sola lettura su una tabella dell'indice. */
class LanceIndexTable implements IndexTable {
  private readonly connection: lancedb.Connection
  private readonly table: lancedb.Table

  constructor(connection: lancedb.Connection, table: lancedb.Table) {
    this.connection = connection
    this.table = table
  }

  countRows(): Promise<number> {
    return this.table.countRows()
  }

  async search(params: IndexSearchParams): Promise<IndexSearchRow[]> {
    let query = this.table
      .query()
      .nearestTo(params.vector as number[])
      .column(params.column)
      .limit(params.limit)

    if (params.prefilter !== null) {
      // `where` prima della ricerca ANN è il prefiltro nativo di LanceDB.
      query = query.where(params.prefilter)
    }

    const rows = (await query.toArray()) as Record<string, unknown>[]
    return rows.map((row) => splitDistance(row, params.column))
  }

  close(): Promise<void> {
    // `close` è sincrono e opzionale in LanceDB (le risorse native sarebbero
    // liberate anche dal GC): lo invochiamo esplicitamente per un rilascio
    // deterministico. La connessione va chiusa insieme alla tabella, altrimenti
    // resterebbe aperta finché non viene raccolta.
    this.table.close()
    this.connection.close()
    return Promise.resolve()
  }
}

/**
 * Separa la distanza dai dati e rimuove la colonna del vettore (grande e non
 * utile a valle) dalla riga restituita. Esportata per il test unitario del
 * contratto con le righe grezze del motore.
 */
export function splitDistance(row: Record<string, unknown>, vectorColumn: string): IndexSearchRow {
  const dati: Record<string, unknown> = {}
  let distance: unknown
  for (const [key, value] of Object.entries(row)) {
    if (key === DISTANCE_COLUMN) {
      distance = value
    } else if (key !== vectorColumn) {
      dati[key] = value
    }
  }
  if (typeof distance !== 'number') {
    // Ogni riga di una ricerca `nearestTo` porta la colonna `_distance`: la sua
    // assenza segnala un contratto rotto col motore, non un caso da ignorare.
    throw new IndexError(
      `Riga dell'indice senza colonna di distanza "${DISTANCE_COLUMN}".`,
      'MALFORMED_ROW'
    )
  }
  return { distanza: distance, dati }
}

/**
 * Connettore LanceDB: apre una connessione locale disk-based (mmap) alla
 * cartella dell'indice e restituisce un handle di sola lettura sulla tabella.
 */
export function createLanceConnector(): IndexConnector {
  return {
    async openTable(indexDir: string, tableName: string): Promise<IndexTable> {
      const db = await lancedb.connect(indexDir)

      const names = await db.tableNames()
      if (!names.includes(tableName)) {
        db.close()
        throw new IndexError(
          `Tabella "${tableName}" non trovata nell'indice ${indexDir}.`,
          'TABLE_NOT_FOUND'
        )
      }

      const table = await db.openTable(tableName)
      return new LanceIndexTable(db, table)
    }
  }
}

/**
 * Carica il manifest dal file `manifest.json` nella cartella dell'indice.
 *
 * @throws {IndexError} `MANIFEST_NOT_FOUND` se il file non esiste,
 *   `MANIFEST_INVALID` se non è JSON valido.
 */
export async function loadManifestFromDisk(indexDir: string): Promise<unknown> {
  const manifestPath = join(indexDir, INDEX_MANIFEST_FILE_NAME)

  let content: string
  try {
    content = await readFile(manifestPath, 'utf8')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new IndexError(`Manifest non trovato: ${manifestPath}.`, 'MANIFEST_NOT_FOUND', {
        cause
      })
    }
    throw cause
  }

  try {
    return JSON.parse(content) as unknown
  } catch (cause) {
    throw new IndexError(`Manifest non è JSON valido: ${manifestPath}.`, 'MANIFEST_INVALID', {
      cause
    })
  }
}

/** Opzioni per aprire un indice LanceDB su disco. */
export interface OpenLanceNormativeIndexOptions {
  /**
   * Embedder con cui l'app produrrà le query. Se fornito, l'apertura rifiuta un
   * indice il cui manifest dichiara un embedder incompatibile.
   */
  expectedEmbedder?: EmbedderIdentity
}

/**
 * Apre un indice normativo su LanceDB in sola lettura: legge e valida il
 * manifest da `manifest.json`, verifica la compatibilità dell'embedder e apre
 * la tabella dichiarata nel manifest.
 */
export function openLanceNormativeIndex(
  indexDir: string,
  options: OpenLanceNormativeIndexOptions = {}
): Promise<NormativeIndex> {
  return openNormativeIndex({
    indexDir,
    connector: createLanceConnector(),
    manifestLoader: loadManifestFromDisk,
    expectedEmbedder: options.expectedEmbedder
  })
}
