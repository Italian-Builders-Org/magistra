import assert from 'node:assert/strict'
import test from 'node:test'

import { runJob, type JobHandler, type JobItem } from '../src/job-runtime.ts'
import { InMemoryJobSink } from '../src/job-sink.ts'
import { InMemoryJobStore } from '../src/job-store.ts'

/** Item finti: quelli il cui input contiene «rotto» fanno esplodere l'handler. */
function itemFixture(ids: readonly string[]): JobItem<string>[] {
  return ids.map((id) => ({ id, input: `contenuto di ${id}` }))
}

/** Handler-fixture: lancia sugli input rotti, segnala «parziale» su quelli scarni. */
const handlerFixture: JobHandler<string, string> = (item) => {
  if (item.id.includes('rotto')) {
    throw new Error(`parsing fallito su ${item.id}`)
  }

  if (item.id.includes('scarno')) {
    return Promise.resolve({
      esito: 'parziale',
      output: item.input.toUpperCase(),
      note: ['contenuto incompleto']
    })
  }

  return Promise.resolve({ esito: 'ok', output: item.input.toUpperCase() })
}

test('un item rotto va in quarantena e il job prosegue con i successivi', async () => {
  const store = new InMemoryJobStore()
  const sink = new InMemoryJobSink<string>()
  const items = itemFixture(['a', 'b-rotto', 'c'])

  const summary = await runJob(
    { jobId: 'j1', tipo: 'fixture', items, totale: items.length },
    handlerFixture,
    { store, sink }
  )

  assert.equal(summary.stato, 'completato_con_quarantena')
  assert.equal(summary.ok, 2)
  assert.equal(summary.inQuarantena, 1)
  assert.equal(summary.elaborati, 3)
  assert.equal(summary.totale, 3)
  assert.deepEqual(
    sink.scritti.map((scrittura) => scrittura.itemId),
    ['a', 'c']
  )
})

test('la quarantena conserva l input grezzo e il motivo', async () => {
  const store = new InMemoryJobStore()
  const sink = new InMemoryJobSink<string>()

  await runJob({ jobId: 'j1', tipo: 'fixture', items: itemFixture(['b-rotto']) }, handlerFixture, {
    store,
    sink
  })

  assert.equal(store.quarantena.length, 1)
  assert.equal(store.quarantena[0]?.itemId, 'b-rotto')
  assert.equal(store.quarantena[0]?.rawInput, 'contenuto di b-rotto')
  assert.match(store.quarantena[0]?.motivo ?? '', /parsing fallito su b-rotto/)
})

test('un esito parziale finisce comunque nel sink ed e contato a parte', async () => {
  const store = new InMemoryJobStore()
  const sink = new InMemoryJobSink<string>()
  const items = itemFixture(['a', 'b-scarno'])

  const summary = await runJob(
    { jobId: 'j1', tipo: 'fixture', items, totale: items.length },
    handlerFixture,
    { store, sink }
  )

  assert.equal(summary.stato, 'completato')
  assert.equal(summary.ok, 1)
  assert.equal(summary.parziali, 1)
  assert.equal(summary.inQuarantena, 0)
  assert.equal(sink.scritti.length, 2)
})

test('un job senza quarantena si chiude come completato', async () => {
  const store = new InMemoryJobStore()
  const sink = new InMemoryJobSink<string>()

  const summary = await runJob(
    { jobId: 'j1', tipo: 'fixture', items: itemFixture(['a', 'b']) },
    handlerFixture,
    { store, sink }
  )

  assert.equal(summary.stato, 'completato')
  assert.equal(summary.totale, null)
})

test('il checkpoint viene salvato dopo ogni item, quarantena compresa', async () => {
  const store = new InMemoryJobStore()
  const sink = new InMemoryJobSink<string>()

  await runJob(
    { jobId: 'j1', tipo: 'fixture', items: itemFixture(['a', 'b-rotto', 'c']) },
    handlerFixture,
    { store, sink }
  )

  assert.equal(store.salvataggi, 3)
  assert.deepEqual((await store.loadCheckpoint('j1'))?.esiti, {
    a: 'ok',
    'b-rotto': 'quarantena',
    c: 'ok'
  })
})

test('il runtime accetta una sorgente asincrona e allora il totale resta ignoto', async () => {
  const store = new InMemoryJobStore()
  const sink = new InMemoryJobSink<string>()

  async function* sorgente(): AsyncGenerator<JobItem<string>> {
    for (const item of itemFixture(['a', 'b'])) {
      yield await Promise.resolve(item)
    }
  }

  const summary = await runJob(
    { jobId: 'j1', tipo: 'fixture', items: sorgente() },
    handlerFixture,
    { store, sink }
  )

  assert.equal(summary.ok, 2)
  assert.equal(summary.totale, null)
})
