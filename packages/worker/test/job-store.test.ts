import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { FileJobStore, InMemoryJobStore } from '../src/job-store.ts'

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

test('FileJobStore rilegge il checkpoint che ha scritto', async () => {
  const root = await mkdtemp(join(tmpdir(), 'magistra-job-store-'))
  const store = new FileJobStore(root)

  assert.equal(await store.loadCheckpoint('j1'), null)

  await store.saveCheckpoint({ jobId: 'j1', tipo: 'fixture', esiti: { a: 'ok', b: 'quarantena' } })
  const ripreso = await store.loadCheckpoint('j1')

  assert.equal(ripreso?.tipo, 'fixture')
  assert.deepEqual(ripreso?.esiti, { a: 'ok', b: 'quarantena' })
})

test('FileJobStore non lascia file temporanei dopo il salvataggio', async () => {
  const root = await mkdtemp(join(tmpdir(), 'magistra-job-store-'))
  const store = new FileJobStore(root)

  await store.saveCheckpoint({ jobId: 'j1', tipo: 'fixture', esiti: { a: 'ok' } })
  await store.saveCheckpoint({ jobId: 'j1', tipo: 'fixture', esiti: { a: 'ok', b: 'ok' } })

  const contenuto = await readdir(join(root, 'j1'))

  assert.deepEqual(contenuto, ['checkpoint.json'])
})

test('FileJobStore sopravvive a un checkpoint troncato da una scrittura interrotta', async () => {
  const root = await mkdtemp(join(tmpdir(), 'magistra-job-store-'))
  const store = new FileJobStore(root)

  await store.saveCheckpoint({ jobId: 'j1', tipo: 'fixture', esiti: { a: 'ok' } })
  // Simula il file temporaneo lasciato da un processo ucciso a meta scrittura:
  // il rename non e mai avvenuto, quindi il checkpoint buono deve restare tale.
  await writeFile(join(root, 'j1', 'checkpoint.json.tmp'), '{"jobId":"j1","tip', 'utf8')

  const ripreso = await store.loadCheckpoint('j1')

  assert.deepEqual(ripreso?.esiti, { a: 'ok' })
})

test('FileJobStore preserva su disco l input grezzo di un item in quarantena', async () => {
  const root = await mkdtemp(join(tmpdir(), 'magistra-job-store-'))
  const store = new FileJobStore(root)

  await store.quarantine('j1', {
    itemId: 'atto/rotto 1',
    rawInput: '<akn>non chiuso',
    motivo: 'XML non valido'
  })

  const base = encodeURIComponent('atto/rotto 1')
  const grezzo = await readFile(join(root, 'j1', 'quarantena', `${base}.input`), 'utf8')
  const errore = JSON.parse(
    await readFile(join(root, 'j1', 'quarantena', `${base}.errore.json`), 'utf8')
  ) as { itemId: string; motivo: string }

  assert.equal(grezzo, '<akn>non chiuso')
  assert.equal(errore.itemId, 'atto/rotto 1')
  assert.equal(errore.motivo, 'XML non valido')
})

test('FileJobStore serializza in JSON un input grezzo non testuale', async () => {
  const root = await mkdtemp(join(tmpdir(), 'magistra-job-store-'))
  const store = new FileJobStore(root)

  await store.quarantine('j1', {
    itemId: 'oggetto',
    rawInput: { eli: 'urn:lex:it:stato:legge:2020', articoli: 3 },
    motivo: 'struttura inattesa'
  })

  const grezzo = await readFile(join(root, 'j1', 'quarantena', 'oggetto.input'), 'utf8')

  assert.deepEqual(JSON.parse(grezzo), { eli: 'urn:lex:it:stato:legge:2020', articoli: 3 })
})

test('FileJobStore non tocca il checkpoint buono se la scrittura temporanea fallisce', async () => {
  const root = await mkdtemp(join(tmpdir(), 'magistra-job-store-'))
  const store = new FileJobStore(root)

  await store.saveCheckpoint({ jobId: 'j1', tipo: 'fixture', esiti: { a: 'ok' } })
  // Occupa il percorso temporaneo con una cartella: la scrittura del file
  // temporaneo fallira, e il checkpoint precedente deve restare intatto.
  await mkdir(join(root, 'j1', 'checkpoint.json.tmp'), { recursive: true })

  await assert.rejects(
    store.saveCheckpoint({ jobId: 'j1', tipo: 'fixture', esiti: { a: 'ok', b: 'ok' } })
  )

  assert.deepEqual((await store.loadCheckpoint('j1'))?.esiti, { a: 'ok' })
})
