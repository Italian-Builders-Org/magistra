import assert from 'node:assert/strict'
import test from 'node:test'

import { IncompatibleEmbedderError, IndexError } from '../src/errors.ts'
import type { EmbedderIdentity } from '../src/manifest.ts'
import {
  openNormativeIndex,
  type IndexConnector,
  type IndexSearchParams,
  type IndexSearchRow,
  type IndexTable
} from '../src/interface.ts'

const EMBEDDER: EmbedderIdentity = {
  nome: 'snowflake-arctic-embed-m-v2.0',
  dimensioni: 3,
  versione: '2.0'
}

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    versione_schema: 1,
    embedder: { ...EMBEDDER },
    metrica: 'cosine',
    strategia: 'flat',
    tabella: 'chunks',
    colonna_vettore: 'vector',
    schema_metadati: { versione: 1, campi: [] },
    ...overrides
  }
}

/** Tabella fake che registra i parametri di ricerca e ritorna righe canoniche. */
class FakeTable implements IndexTable {
  public lastSearch: IndexSearchParams | null = null
  public closed = false
  private readonly rows: IndexSearchRow[]

  constructor(rows: IndexSearchRow[]) {
    this.rows = rows
  }

  countRows(): Promise<number> {
    return Promise.resolve(this.rows.length)
  }

  search(params: IndexSearchParams): Promise<IndexSearchRow[]> {
    this.lastSearch = params
    return Promise.resolve(this.rows)
  }

  close(): Promise<void> {
    this.closed = true
    return Promise.resolve()
  }
}

function fakeConnector(table: IndexTable): IndexConnector {
  return { openTable: () => Promise.resolve(table) }
}

const loader = (raw: unknown) => () => Promise.resolve(raw)

test("openNormativeIndex apre l'indice e ne espone il manifest validato", async () => {
  const table = new FakeTable([])
  const index = await openNormativeIndex({
    indexDir: '/x',
    connector: fakeConnector(table),
    manifestLoader: loader(manifest())
  })

  assert.equal(index.manifest.tabella, 'chunks')
  assert.equal(index.manifest.embedder.dimensioni, 3)
  assert.equal(await index.countChunks(), 0)
})

test('openNormativeIndex rifiuta un manifest non conforme', async () => {
  await assert.rejects(
    openNormativeIndex({
      indexDir: '/x',
      connector: fakeConnector(new FakeTable([])),
      manifestLoader: loader({ versione_schema: 1 })
    }),
    (err: unknown) => err instanceof IndexError && err.code === 'MANIFEST_INVALID'
  )
})

test('openNormativeIndex rifiuta un indice con embedder incompatibile', async () => {
  await assert.rejects(
    openNormativeIndex({
      indexDir: '/x',
      connector: fakeConnector(new FakeTable([])),
      manifestLoader: loader(manifest()),
      expectedEmbedder: { ...EMBEDDER, dimensioni: 768 }
    }),
    (err: unknown) => {
      assert.ok(err instanceof IncompatibleEmbedderError)
      assert.equal(err.code, 'INCOMPATIBLE_EMBEDDER')
      assert.equal(err.actual.dimensioni, 3)
      assert.equal(err.expected.dimensioni, 768)
      return true
    }
  )
})

test('openNormativeIndex accetta un embedder atteso compatibile', async () => {
  const index = await openNormativeIndex({
    indexDir: '/x',
    connector: fakeConnector(new FakeTable([])),
    manifestLoader: loader(manifest()),
    expectedEmbedder: { ...EMBEDDER }
  })
  assert.equal(index.manifest.embedder.nome, EMBEDDER.nome)
})

test('query rifiuta un vettore di dimensione errata', async () => {
  const index = await openNormativeIndex({
    indexDir: '/x',
    connector: fakeConnector(new FakeTable([])),
    manifestLoader: loader(manifest())
  })

  await assert.rejects(
    index.query([1, 0]),
    (err: unknown) => err instanceof IndexError && err.code === 'INVALID_QUERY_VECTOR'
  )
})

test('query passa al motore il prefiltro e la colonna del vettore, e mappa i risultati', async () => {
  const table = new FakeTable([
    { distanza: 0.1, dati: { id: 'a', testo: 'Testo A', tipo_atto: 'legge' } },
    { distanza: 0.4, dati: { id: 'b', testo: 'Testo B', tipo_atto: 'legge' } }
  ])
  const index = await openNormativeIndex({
    indexDir: '/x',
    connector: fakeConnector(table),
    manifestLoader: loader(manifest())
  })

  const hits = await index.query([1, 0, 0], {
    filter: { tipoAtto: 'legge', vigenteAl: '2021-01-01' },
    limit: 5
  })

  assert.equal(table.lastSearch?.column, 'vector')
  assert.equal(table.lastSearch?.limit, 5)
  assert.equal(
    table.lastSearch?.prefilter,
    "vigenza_da <= '2021-01-01' AND (vigenza_a IS NULL OR vigenza_a >= '2021-01-01') AND tipo_atto = 'legge'"
  )

  assert.equal(hits.length, 2)
  assert.equal(hits[0]!.id, 'a')
  assert.equal(hits[0]!.testo, 'Testo A')
  assert.equal(hits[0]!.distanza, 0.1)
  // La riga grezza resta accessibile per i metadati di citazione a valle.
  assert.equal(hits[0]!.riga.tipo_atto, 'legge')
})

test('query senza filtro non passa alcun prefiltro', async () => {
  const table = new FakeTable([])
  const index = await openNormativeIndex({
    indexDir: '/x',
    connector: fakeConnector(table),
    manifestLoader: loader(manifest())
  })

  await index.query([1, 0, 0])
  assert.equal(table.lastSearch?.prefilter, null)
})

test('close propaga la chiusura al motore', async () => {
  const table = new FakeTable([])
  const index = await openNormativeIndex({
    indexDir: '/x',
    connector: fakeConnector(table),
    manifestLoader: loader(manifest())
  })

  await index.close()
  assert.equal(table.closed, true)
})
