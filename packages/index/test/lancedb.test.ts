import assert from 'node:assert/strict'
import test from 'node:test'

import { IndexError } from '../src/errors.ts'
import { splitDistance } from '../src/lancedb.ts'

// Test unitari del connettore LanceDB che non richiedono il binario nativo:
// coprono il contratto con le righe grezze del motore (colonna di distanza,
// rimozione del vettore). L'end-to-end col motore reale è in
// `lancedb.integration.test.ts`.

test('splitDistance estrae la distanza e rimuove la colonna del vettore', () => {
  const row = {
    id: 'a',
    testo: 'Testo',
    tipo_atto: 'legge',
    vector: [0.1, 0.2, 0.3],
    _distance: 0.42
  }

  const { distanza, dati } = splitDistance(row, 'vector')

  assert.equal(distanza, 0.42)
  // Il vettore (grande e inutile a valle) non viene propagato.
  assert.equal(dati.vector, undefined)
  // La colonna di distanza è separata, non finisce tra i dati.
  assert.equal(dati._distance, undefined)
  // Gli altri metadati restano accessibili per citazione/filtro.
  assert.deepEqual(dati, { id: 'a', testo: 'Testo', tipo_atto: 'legge' })
})

test('splitDistance rispetta il nome della colonna del vettore dal manifest', () => {
  const row = { id: 'a', embedding: [1, 2, 3], _distance: 1 }
  const { dati } = splitDistance(row, 'embedding')
  assert.equal(dati.embedding, undefined)
  assert.equal(dati.id, 'a')
})

test('splitDistance rifiuta una riga senza colonna di distanza', () => {
  const row = { id: 'a', testo: 'Testo', vector: [1, 2, 3] }
  assert.throws(
    () => splitDistance(row, 'vector'),
    (err: unknown) => err instanceof IndexError && err.code === 'MALFORMED_ROW'
  )
})

test('splitDistance rifiuta una distanza non numerica', () => {
  const row = { id: 'a', vector: [1, 2, 3], _distance: 'vicino' }
  assert.throws(
    () => splitDistance(row, 'vector'),
    (err: unknown) => err instanceof IndexError && err.code === 'MALFORMED_ROW'
  )
})
