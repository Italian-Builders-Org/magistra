import { PGlite } from '@electric-sql/pglite'

import type { SqlDriver, SqlExecutor } from './driver.ts'
import { createDataStore, type CreateDataStoreOptions, type DataStore } from './store.ts'

// Adattatore del motore PGlite.
//
// Traduce l'interfaccia `SqlDriver` (il confine visto dallo strato dati) sulle
// API di PGlite. E l'unico punto del pacchetto che importa PGlite: tutto il
// resto conosce solo `SqlDriver`, cosi il motore resta isolato e sostituibile.
// PGlite e Postgres compilato in WebAssembly, in-process, senza servizi esterni;
// la stessa connessione e l'unico scrittore (single-connection).

/** Sottoinsieme di PGlite/Transaction che l'adattatore usa (query + exec). */
type PgQueryable = Pick<PGlite, 'query' | 'exec'>

function toExecutor(pg: PgQueryable): SqlExecutor {
  return {
    async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]) {
      const result = await pg.query<Row>(sql, params ? [...params] : undefined)
      return { rows: result.rows }
    },
    async exec(sql: string) {
      await pg.exec(sql)
    }
  }
}

/**
 * Costruisce un `SqlDriver` a partire da un'istanza PGlite gia pronta. La
 * transazione dello store viene mappata su quella di PGlite: la callback riceve
 * lo stesso contratto `SqlExecutor` della connessione principale.
 */
export function createPgliteDriver(pg: PGlite): SqlDriver {
  const base = toExecutor(pg)
  return {
    query: base.query,
    exec: base.exec,
    transaction: (fn) => pg.transaction((tx) => fn(toExecutor(tx))),
    close: () => pg.close()
  }
}

/** Opzioni per aprire uno store su PGlite. */
export interface OpenDataStoreOptions extends CreateDataStoreOptions {
  /**
   * Cartella di persistenza del database. Se omessa, il database vive in memoria
   * (utile nei test); in produzione e un percorso nella cartella dati dell'app.
   */
  dataDir?: string
}

/**
 * Apre uno store dei dati applicativi su PGlite e ne porta lo schema alla
 * versione corrente. E la via pronta all'uso per l'app desktop; i test possono
 * comunque comporre `createPgliteDriver` + `createDataStore` a mano.
 */
export async function openDataStore(options: OpenDataStoreOptions = {}): Promise<DataStore> {
  const { dataDir, ...storeOptions } = options
  const pg = new PGlite(dataDir ? { dataDir } : undefined)
  await pg.waitReady
  const driver = createPgliteDriver(pg)
  const store = createDataStore(driver, storeOptions)
  await store.migrate()
  return store
}
