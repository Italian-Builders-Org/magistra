import assert from 'node:assert/strict'
import test from 'node:test'

import { JobError, runJob, type JobHandler, type JobItem } from '../src/job-runtime.ts'
import { InMemoryJobSink } from '../src/job-sink.ts'
import { InMemoryJobStore } from '../src/job-store.ts'

import type { JobProgress } from '@magistra/shared'

import type { JobSink } from '../src/job-sink.ts'
import type { JobStore } from '../src/job-store.ts'

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

test('la ripresa tratta solo gli item non ancora elaborati', async () => {
  const store = new InMemoryJobStore()
  const invocati: string[] = []
  const handlerTracciante: JobHandler<string, string> = (item) => {
    invocati.push(item.id)

    return handlerFixture(item)
  }

  const tutti = itemFixture(['a', 'b', 'c', 'd'])

  // Prima esecuzione: solo i primi due item. Equivale a un job interrotto,
  // ma in modo deterministico e senza uccidere processi.
  await runJob({ jobId: 'j1', tipo: 'fixture', items: tutti.slice(0, 2) }, handlerTracciante, {
    store,
    sink: new InMemoryJobSink<string>()
  })

  assert.deepEqual(invocati, ['a', 'b'])

  // Seconda esecuzione con lo stesso jobId e la lista completa.
  const sink = new InMemoryJobSink<string>()
  const summary = await runJob(
    { jobId: 'j1', tipo: 'fixture', items: tutti, totale: tutti.length },
    handlerTracciante,
    { store, sink }
  )

  assert.deepEqual(invocati, ['a', 'b', 'c', 'd'])
  assert.deepEqual(
    sink.scritti.map((scrittura) => scrittura.itemId),
    ['c', 'd']
  )
  assert.equal(summary.ok, 4)
  assert.equal(summary.elaborati, 4)
  assert.equal(summary.stato, 'completato')
})

test('un item in quarantena non viene ritentato alla ripresa', async () => {
  const store = new InMemoryJobStore()
  const invocati: string[] = []
  const handlerTracciante: JobHandler<string, string> = (item) => {
    invocati.push(item.id)

    return handlerFixture(item)
  }

  const items = itemFixture(['a', 'b-rotto'])

  await runJob({ jobId: 'j1', tipo: 'fixture', items }, handlerTracciante, {
    store,
    sink: new InMemoryJobSink<string>()
  })
  const summary = await runJob({ jobId: 'j1', tipo: 'fixture', items }, handlerTracciante, {
    store,
    sink: new InMemoryJobSink<string>()
  })

  assert.deepEqual(invocati, ['a', 'b-rotto'])
  assert.equal(store.quarantena.length, 1)
  assert.equal(summary.inQuarantena, 1)
  assert.equal(summary.stato, 'completato_con_quarantena')
})

test('un sink che fallisce interrompe il job e non mette l item in quarantena', async () => {
  const store = new InMemoryJobStore()
  const sinkRotto: JobSink<string> = {
    write() {
      return Promise.reject(new Error('disco pieno'))
    }
  }

  await assert.rejects(
    runJob({ jobId: 'j1', tipo: 'fixture', items: itemFixture(['a']) }, handlerFixture, {
      store,
      sink: sinkRotto
    }),
    (error: unknown) => {
      assert.ok(error instanceof JobError)
      assert.equal(error.code, 'SINK_FALLITO')

      return true
    }
  )

  // L'input era valido: il guasto e dell'infrastruttura, non dell'item.
  assert.equal(store.quarantena.length, 0)
})

test('un checkpoint che fallisce interrompe il job', async () => {
  const storeRotto: JobStore = {
    loadCheckpoint() {
      return Promise.resolve(null)
    },
    saveCheckpoint() {
      return Promise.reject(new Error('sola lettura'))
    },
    quarantine() {
      return Promise.resolve()
    }
  }

  await assert.rejects(
    runJob({ jobId: 'j1', tipo: 'fixture', items: itemFixture(['a']) }, handlerFixture, {
      store: storeRotto,
      sink: new InMemoryJobSink<string>()
    }),
    (error: unknown) => {
      assert.ok(error instanceof JobError)
      assert.equal(error.code, 'CHECKPOINT_FALLITO')

      return true
    }
  )
})

test('una quarantena che fallisce interrompe il job', async () => {
  const storeRotto: JobStore = {
    loadCheckpoint() {
      return Promise.resolve(null)
    },
    saveCheckpoint() {
      return Promise.resolve()
    },
    quarantine() {
      return Promise.reject(new Error('cartella non scrivibile'))
    }
  }

  await assert.rejects(
    runJob({ jobId: 'j1', tipo: 'fixture', items: itemFixture(['b-rotto']) }, handlerFixture, {
      store: storeRotto,
      sink: new InMemoryJobSink<string>()
    }),
    (error: unknown) => {
      assert.ok(error instanceof JobError)
      assert.equal(error.code, 'QUARANTENA_FALLITA')

      return true
    }
  )
})

test('l avanzamento viene emesso dopo ogni item e i conteggi tornano', async () => {
  const store = new InMemoryJobStore()
  const sink = new InMemoryJobSink<string>()
  const avanzamenti: JobProgress[] = []
  const items = itemFixture(['a', 'b-rotto', 'c-scarno'])

  await runJob({ jobId: 'j1', tipo: 'fixture', items, totale: items.length }, handlerFixture, {
    store,
    sink,
    onProgress: (progress) => avanzamenti.push(progress)
  })

  assert.equal(avanzamenti.length, 3)
  assert.deepEqual(
    avanzamenti.map((progress) => progress.elaborati),
    [1, 2, 3]
  )

  const ultimo = avanzamenti[2]
  assert.equal(ultimo?.ok, 1)
  assert.equal(ultimo?.parziali, 1)
  assert.equal(ultimo?.inQuarantena, 1)
  assert.equal(ultimo?.totale, 3)
  // L'invariante dichiarata nel contratto condiviso.
  assert.equal(
    ultimo?.elaborati,
    (ultimo?.ok ?? 0) + (ultimo?.parziali ?? 0) + (ultimo?.inQuarantena ?? 0)
  )
})
