import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import * as lancedb from '@lancedb/lancedb'
import { Field, FixedSizeList, Float32, Int32, Schema, Utf8 } from 'apache-arrow'

import { IncompatibleEmbedderError } from '../src/errors.ts'
import { INDEX_MANIFEST_FILE_NAME, type EmbedderIdentity } from '../src/manifest.ts'
import { openLanceNormativeIndex } from '../src/lancedb.ts'

const EMBEDDER: EmbedderIdentity = {
  nome: 'test-embedder',
  dimensioni: 3,
  versione: '1.0'
}

const TABLE = 'chunks'

const SCHEMA = new Schema([
  new Field('id', new Utf8(), false),
  new Field('unita_id', new Utf8(), false),
  new Field('indice', new Int32(), false),
  new Field('testo', new Utf8(), false),
  new Field('tipo_atto', new Utf8(), false),
  new Field('fonte', new Utf8(), false),
  new Field('vigenza_da', new Utf8(), false),
  new Field('vigenza_a', new Utf8(), true),
  new Field('vector', new FixedSizeList(3, new Field('item', new Float32(), false)), false)
])

const ROWS = [
  // legge vigente al 2021-06: candidato valido, il più vicino a [1,0,0].
  {
    id: 'a',
    unita_id: 'u1',
    indice: 0,
    testo: 'Legge vigente vicina',
    tipo_atto: 'legge',
    fonte: 'normattiva',
    vigenza_da: '2020-01-01',
    vigenza_a: null,
    vector: [1, 0, 0]
  },
  // decreto: escluso dal filtro tipo_atto anche se vicino.
  {
    id: 'b',
    unita_id: 'u2',
    indice: 0,
    testo: 'Decreto vicino',
    tipo_atto: 'decreto',
    fonte: 'normattiva',
    vigenza_da: '2019-01-01',
    vigenza_a: '2022-01-01',
    vector: [0.95, 0.05, 0]
  },
  // legge ma non ancora vigente al 2021-06 (vigenza_da 2022): esclusa dalla vigenza.
  {
    id: 'c',
    unita_id: 'u3',
    indice: 0,
    testo: 'Legge futura',
    tipo_atto: 'legge',
    fonte: 'normattiva',
    vigenza_da: '2022-01-01',
    vigenza_a: null,
    vector: [0.9, 0.1, 0]
  },
  // legge vigente ma più lontana da [1,0,0].
  {
    id: 'd',
    unita_id: 'u4',
    indice: 0,
    testo: 'Legge vigente lontana',
    tipo_atto: 'legge',
    fonte: 'normattiva',
    vigenza_da: '2015-01-01',
    vigenza_a: '2023-01-01',
    vector: [0, 1, 0]
  },
  // legge la cui vigenza si è chiusa prima del 2021-06: esclusa.
  {
    id: 'e',
    unita_id: 'u5',
    indice: 0,
    testo: 'Legge abrogata',
    tipo_atto: 'legge',
    fonte: 'normattiva',
    vigenza_da: '2010-01-01',
    vigenza_a: '2018-01-01',
    vector: [0.8, 0.2, 0]
  }
]

/** Crea una cartella di indice LanceDB con manifest, oppure salta se il motore nativo non è disponibile. */
async function buildIndex(
  t: import('node:test').TestContext,
  manifestOverrides: Record<string, unknown> = {}
): Promise<string> {
  let indexDir: string
  try {
    indexDir = await mkdtemp(join(tmpdir(), 'magistra-index-'))
    const db = await lancedb.connect(indexDir)
    await db.createTable(TABLE, ROWS, { schema: SCHEMA })
  } catch (err) {
    t.skip(`LanceDB nativo non disponibile in questo ambiente: ${(err as Error).message}`)
    return ''
  }

  const manifest = {
    versione_schema: 1,
    embedder: { ...EMBEDDER },
    metrica: 'l2',
    strategia: 'flat',
    tabella: TABLE,
    colonna_vettore: 'vector',
    schema_metadati: {
      versione: 1,
      campi: [
        { nome: 'tipo_atto', tipo: 'string', filtrabile: true },
        { nome: 'fonte', tipo: 'string', filtrabile: true },
        { nome: 'vigenza_da', tipo: 'date', filtrabile: true },
        { nome: 'vigenza_a', tipo: 'date', nullable: true, filtrabile: true }
      ]
    },
    ...manifestOverrides
  }
  await writeFile(join(indexDir, INDEX_MANIFEST_FILE_NAME), JSON.stringify(manifest, null, 2))
  return indexDir
}

test('apre un indice di prova e la query filtrata ritorna solo i risultati corretti', async (t) => {
  const indexDir = await buildIndex(t)
  if (!indexDir) return

  const index = await openLanceNormativeIndex(indexDir, { expectedEmbedder: EMBEDDER })
  try {
    assert.equal(await index.countChunks(), ROWS.length)

    const hits = await index.query([1, 0, 0], {
      filter: { tipoAtto: 'legge', vigenteAl: '2021-06-01' },
      limit: 10
    })

    // Solo 'a' e 'd' sono leggi vigenti al 2021-06; 'a' è più vicino a [1,0,0].
    assert.deepEqual(
      hits.map((h) => h.id),
      ['a', 'd']
    )
    assert.equal(hits[0]!.testo, 'Legge vigente vicina')
    assert.ok(hits[0]!.distanza <= hits[1]!.distanza)
    // La colonna del vettore non viene restituita nella riga grezza.
    assert.equal(hits[0]!.riga.vector, undefined)
    assert.equal(hits[0]!.riga.tipo_atto, 'legge')
  } finally {
    await index.close()
  }
})

test('la query senza filtro cerca su tutto il corpus', async (t) => {
  const indexDir = await buildIndex(t)
  if (!indexDir) return

  const index = await openLanceNormativeIndex(indexDir)
  try {
    const hits = await index.query([1, 0, 0], { limit: 3 })
    assert.equal(hits.length, 3)
    // Il più vicino a [1,0,0] è 'a'.
    assert.equal(hits[0]!.id, 'a')
  } finally {
    await index.close()
  }
})

test('dopo close le risorse del motore sono rilasciate', async (t) => {
  const indexDir = await buildIndex(t)
  if (!indexDir) return

  const index = await openLanceNormativeIndex(indexDir, { expectedEmbedder: EMBEDDER })
  await index.close()

  // LanceDB rifiuta ogni uso di tabella/connessione dopo la chiusura: se `close`
  // avesse dimenticato di rilasciarle, questa query passerebbe.
  await assert.rejects(index.countChunks())
})

test('rifiuta un indice il cui manifest dichiara un embedder incompatibile', async (t) => {
  const indexDir = await buildIndex(t)
  if (!indexDir) return

  await assert.rejects(
    openLanceNormativeIndex(indexDir, {
      expectedEmbedder: { ...EMBEDDER, dimensioni: 768 }
    }),
    (err: unknown) => err instanceof IncompatibleEmbedderError
  )
})
