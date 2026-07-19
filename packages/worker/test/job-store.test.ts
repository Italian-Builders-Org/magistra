import assert from 'node:assert/strict'
import test from 'node:test'

import { InMemoryJobStore } from '../src/job-store.ts'

test('InMemoryJobStore non conosce un job mai salvato', async () => {
  const store = new InMemoryJobStore()

  assert.equal(await store.loadCheckpoint('mai-visto'), null)
})

test('InMemoryJobStore rilegge il checkpoint salvato e conta i salvataggi', async () => {
  const store = new InMemoryJobStore()

  await store.saveCheckpoint({ jobId: 'j1', tipo: 'fixture', esiti: { a: 'ok' } })
  await store.saveCheckpoint({ jobId: 'j1', tipo: 'fixture', esiti: { a: 'ok', b: 'quarantena' } })

  const ripreso = await store.loadCheckpoint('j1')

  assert.equal(store.salvataggi, 2)
  assert.deepEqual(ripreso?.esiti, { a: 'ok', b: 'quarantena' })
})

test('InMemoryJobStore isola il checkpoint salvato da mutazioni successive', async () => {
  const store = new InMemoryJobStore()
  const esiti: Record<string, 'ok' | 'parziale' | 'quarantena'> = { a: 'ok' }

  await store.saveCheckpoint({ jobId: 'j1', tipo: 'fixture', esiti })
  esiti['b'] = 'ok'

  const ripreso = await store.loadCheckpoint('j1')

  assert.deepEqual(ripreso?.esiti, { a: 'ok' })
})

test('InMemoryJobStore raccoglie le voci di quarantena in ordine', async () => {
  const store = new InMemoryJobStore()

  await store.quarantine('j1', { itemId: 'rotto', rawInput: '<akn>', motivo: 'XML non valido' })

  assert.equal(store.quarantena.length, 1)
  assert.equal(store.quarantena[0]?.itemId, 'rotto')
  assert.equal(store.quarantena[0]?.rawInput, '<akn>')
  assert.equal(store.quarantena[0]?.motivo, 'XML non valido')
})
