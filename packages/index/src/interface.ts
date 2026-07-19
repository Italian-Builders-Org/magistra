import { IndexError, IncompatibleEmbedderError } from './errors.ts'
import { isEmbedderCompatible, parseIndexManifest } from './manifest.ts'
import type { EmbedderIdentity, IndexManifest } from './manifest.ts'
import { buildPrefilter } from './prefilter.ts'
import type { NormativeQueryFilter } from './prefilter.ts'

// Interfaccia dell'indice normativo.
//
// La logica di dominio (retrieval, RAG) raggiunge l'indice solo attraverso
// questo contratto tipizzato, mai accoppiandosi al motore concreto: il motore
// vettoriale (oggi LanceDB) resta isolato dietro l'interfaccia e sostituibile.
// L'accesso qui è di sola lettura: apertura, lettura del manifest e query ANN
// con prefiltro per metadato; la scrittura dell'indice è compito dell'ingest.

/** Riga restituita dal motore per un candidato, con la sua distanza. */
export interface IndexSearchRow {
  /** Distanza dal vettore di query nella metrica dell'indice (più bassa = più simile). */
  distanza: number
  /** Colonne della riga (metadati di filtro e di citazione, testo, id, ...). */
  dati: Readonly<Record<string, unknown>>
}

/** Parametri di una ricerca ANN sul motore. */
export interface IndexSearchParams {
  vector: readonly number[]
  /** Colonna che ospita il vettore (dal manifest). */
  column: string
  /** Clausola SQL del prefiltro, oppure `null` per nessun filtro. */
  prefilter: string | null
  /** Numero massimo di candidati da restituire. */
  limit: number
}

/**
 * Handle di sola lettura su una tabella dell'indice. È il confine sottile che
 * il motore concreto deve implementare; il resto della logica non lo conosce.
 */
export interface IndexTable {
  countRows(): Promise<number>
  search(params: IndexSearchParams): Promise<IndexSearchRow[]>
  close(): Promise<void>
}

/** Apre in sola lettura una tabella di un indice su disco. */
export interface IndexConnector {
  openTable(indexDir: string, tableName: string): Promise<IndexTable>
}

/** Un risultato della ricerca, mappato dai dati grezzi del motore. */
export interface NormativeQueryHit {
  /** Identificativo del chunk (chiave primaria). */
  id: string
  /** Distanza dal vettore di query (più bassa = più simile). */
  distanza: number
  /** Testo del chunk. */
  testo: string
  /** Riga completa dell'indice, per i metadati di filtro e di citazione. */
  riga: Readonly<Record<string, unknown>>
}

/** Opzioni di una query sull'indice. */
export interface NormativeQueryOptions {
  /** Prefiltro tipizzato sui metadati (vigenza, tipo atto, fonte). */
  filter?: NormativeQueryFilter
  /** Numero massimo di risultati (default 10). */
  limit?: number
}

/** L'indice normativo, raggiunto dalla logica di dominio. */
export interface NormativeIndex {
  /** Manifest validato dell'indice aperto. */
  readonly manifest: IndexManifest
  /** Numero di chunk indicizzati. */
  countChunks(): Promise<number>
  /**
   * Cerca i chunk più vicini al vettore di query, applicando il prefiltro per
   * metadato dentro il motore prima della ricerca ANN.
   *
   * @throws {IndexError} `INVALID_QUERY_VECTOR` se la dimensione del vettore non
   *   corrisponde a quella dichiarata nel manifest.
   */
  query(
    queryVector: readonly number[],
    options?: NormativeQueryOptions
  ): Promise<NormativeQueryHit[]>
  /** Rilascia le risorse del motore. */
  close(): Promise<void>
}

export const DEFAULT_QUERY_LIMIT = 10

/** Opzioni per aprire un indice, con i confini iniettabili per la testabilità. */
export interface OpenNormativeIndexOptions {
  /** Cartella dell'indice (contiene il manifest e la tabella del motore). */
  indexDir: string
  /** Motore concreto che apre la tabella (di default LanceDB). */
  connector: IndexConnector
  /** Carica il manifest grezzo; deve lanciare `IndexError` se assente. */
  manifestLoader: (indexDir: string) => Promise<unknown>
  /**
   * Embedder con cui l'app produrrà le query. Se fornito, l'apertura rifiuta un
   * indice il cui manifest dichiara un embedder incompatibile.
   */
  expectedEmbedder?: EmbedderIdentity
}

/**
 * Apre un indice normativo: carica e valida il manifest, verifica la
 * compatibilità dell'embedder e apre la tabella del motore in sola lettura.
 * Orchestrazione indipendente dal motore: riceve `connector` e `manifestLoader`
 * come confini iniettabili.
 *
 * @throws {IndexError} `MANIFEST_INVALID` se il manifest non è conforme.
 * @throws {IncompatibleEmbedderError} se l'embedder atteso non è compatibile.
 */
export async function openNormativeIndex(
  options: OpenNormativeIndexOptions
): Promise<NormativeIndex> {
  const { indexDir, connector, manifestLoader, expectedEmbedder } = options

  const raw = await manifestLoader(indexDir)

  let manifest: IndexManifest
  try {
    manifest = parseIndexManifest(raw)
  } catch (cause) {
    throw new IndexError(`Manifest dell'indice non valido in ${indexDir}.`, 'MANIFEST_INVALID', {
      cause
    })
  }

  if (expectedEmbedder && !isEmbedderCompatible(manifest, expectedEmbedder)) {
    throw new IncompatibleEmbedderError(expectedEmbedder, manifest.embedder)
  }

  const table = await connector.openTable(indexDir, manifest.tabella)

  return new NormativeIndexHandle(manifest, table)
}

class NormativeIndexHandle implements NormativeIndex {
  public readonly manifest: IndexManifest
  private readonly table: IndexTable

  constructor(manifest: IndexManifest, table: IndexTable) {
    this.manifest = manifest
    this.table = table
  }

  countChunks(): Promise<number> {
    return this.table.countRows()
  }

  async query(
    queryVector: readonly number[],
    options: NormativeQueryOptions = {}
  ): Promise<NormativeQueryHit[]> {
    const expectedDim = this.manifest.embedder.dimensioni
    if (queryVector.length !== expectedDim) {
      throw new IndexError(
        `Vettore di query di dimensione ${queryVector.length}, ` +
          `l'indice richiede ${expectedDim}.`,
        'INVALID_QUERY_VECTOR'
      )
    }

    const prefilter = options.filter ? buildPrefilter(options.filter) : null
    const limit = options.limit ?? DEFAULT_QUERY_LIMIT

    const rows = await this.table.search({
      vector: queryVector,
      column: this.manifest.colonna_vettore,
      prefilter,
      limit
    })

    return rows.map(toHit)
  }

  close(): Promise<void> {
    return this.table.close()
  }
}

function toHit(row: IndexSearchRow): NormativeQueryHit {
  const { id, testo } = row.dati
  return {
    id: typeof id === 'string' ? id : String(id ?? ''),
    testo: typeof testo === 'string' ? testo : String(testo ?? ''),
    distanza: row.distanza,
    riga: row.dati
  }
}
