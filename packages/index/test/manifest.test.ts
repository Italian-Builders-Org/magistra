import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isEmbedderCompatible,
  parseIndexManifest,
  type EmbedderIdentity,
  type IndexManifest
} from '../src/manifest.ts'

const EMBEDDER: EmbedderIdentity = {
  nome: 'snowflake-arctic-embed-m-v2.0',
  dimensioni: 768,
  versione: '2.0'
}

function validManifest(): Record<string, unknown> {
  return {
    versione_schema: 1,
    embedder: { ...EMBEDDER },
    metrica: 'cosine',
    strategia: 'flat',
    tabella: 'chunks',
    schema_metadati: {
      versione: 1,
      campi: [
        { nome: 'tipo_atto', tipo: 'string', filtrabile: true },
        { nome: 'vigenza_da', tipo: 'date', filtrabile: true },
        { nome: 'vigenza_a', tipo: 'date', nullable: true, filtrabile: true }
      ]
    }
  }
}

test('parseIndexManifest valida un manifest corretto e applica i default', () => {
  const manifest = parseIndexManifest(validManifest())

  assert.equal(manifest.embedder.dimensioni, 768)
  assert.equal(manifest.strategia, 'flat')
  // `colonna_vettore` ha default `vector`.
  assert.equal(manifest.colonna_vettore, 'vector')
  // `nullable`/`filtrabile` hanno default `false`.
  const tipoAtto = manifest.schema_metadati.campi.find((c) => c.nome === 'tipo_atto')
  assert.equal(tipoAtto?.nullable, false)
})

test('parseIndexManifest rifiuta una versione di schema sconosciuta', () => {
  const raw = { ...validManifest(), versione_schema: 2 }
  assert.throws(() => parseIndexManifest(raw))
})

test('parseIndexManifest rifiuta un embedder senza dimensioni', () => {
  const raw = validManifest()
  ;(raw.embedder as Record<string, unknown>).dimensioni = undefined
  assert.throws(() => parseIndexManifest(raw))
})

test('parseIndexManifest rifiuta una strategia non prevista', () => {
  const raw = { ...validManifest(), strategia: 'hnsw-magico' }
  assert.throws(() => parseIndexManifest(raw))
})

test('isEmbedderCompatible richiede nome, dimensioni e versione uguali', () => {
  const manifest = parseIndexManifest(validManifest()) as IndexManifest

  assert.equal(isEmbedderCompatible(manifest, EMBEDDER), true)
  assert.equal(isEmbedderCompatible(manifest, { ...EMBEDDER, dimensioni: 1024 }), false)
  assert.equal(isEmbedderCompatible(manifest, { ...EMBEDDER, versione: '1.5' }), false)
  assert.equal(isEmbedderCompatible(manifest, { ...EMBEDDER, nome: 'altro-modello' }), false)
})
