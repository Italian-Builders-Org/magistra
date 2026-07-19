import assert from 'node:assert/strict'
import test from 'node:test'

import { DataError } from '../src/errors.ts'
import { selezionaMigrazioniDaApplicare, type Migration } from '../src/migrations.ts'

// Test unitari della selezione delle migrazioni: logica pura, senza motore.
// Verificano quali migrazioni restano da applicare e il rifiuto degli stati
// incoerenti (versione sconosciuta, buco nella sequenza, elenco non contiguo).

const M: Migration[] = [
  { version: 1, nome: 'a', up: '' },
  { version: 2, nome: 'b', up: '' },
  { version: 3, nome: 'c', up: '' }
]

test('da schema vuoto applica tutte le migrazioni in ordine', () => {
  const pendenti = selezionaMigrazioniDaApplicare([], M)
  assert.deepEqual(
    pendenti.map((m) => m.version),
    [1, 2, 3]
  )
})

test('con un prefisso applicato restituisce solo le successive', () => {
  const pendenti = selezionaMigrazioniDaApplicare([1, 2], M)
  assert.deepEqual(
    pendenti.map((m) => m.version),
    [3]
  )
})

test('con tutte applicate non resta nulla', () => {
  assert.deepEqual(selezionaMigrazioniDaApplicare([1, 2, 3], M), [])
})

test('accetta le versioni applicate in qualsiasi ordine', () => {
  const pendenti = selezionaMigrazioniDaApplicare([2, 1], M)
  assert.deepEqual(
    pendenti.map((m) => m.version),
    [3]
  )
})

test('rifiuta una versione applicata sconosciuta', () => {
  assert.throws(
    () => selezionaMigrazioniDaApplicare([1, 2, 3, 4], M),
    (err: unknown) => err instanceof DataError && err.code === 'MIGRATION_INCONSISTENT'
  )
})

test('rifiuta un buco nella sequenza applicata', () => {
  // La 3 risulta applicata ma la 2 no: lo schema non e riproducibile.
  assert.throws(
    () => selezionaMigrazioniDaApplicare([1, 3], M),
    (err: unknown) => err instanceof DataError && err.code === 'MIGRATION_INCONSISTENT'
  )
})

test('rifiuta un elenco di migrazioni non contiguo', () => {
  const nonContiguo: Migration[] = [
    { version: 1, nome: 'a', up: '' },
    { version: 3, nome: 'c', up: '' }
  ]
  assert.throws(
    () => selezionaMigrazioniDaApplicare([], nonContiguo),
    (err: unknown) => err instanceof DataError && err.code === 'MIGRATION_INCONSISTENT'
  )
})
