import assert from 'node:assert/strict'
import test from 'node:test'

import { PGlite } from '@electric-sql/pglite'

import { DataError } from '../src/errors.ts'
import { createDataStore } from '../src/store.ts'
import { createPgliteDriver, openDataStore } from '../src/pglite.ts'
import type { DataStore } from '../src/store.ts'

// Test d'integrazione dello strato dati sul motore reale (PGlite in memoria).
// Provano end-to-end lo schema, le migrazioni e il CRUD delle entita: e la
// verifica che il DDL gira davvero su Postgres-in-WASM, non solo che compila.

/** Generatore di id deterministico, per rendere ripetibili gli asserti. */
function idDeterministici(): () => string {
  let n = 0
  return () => `id-${String(++n).padStart(4, '0')}`
}

/** Apre uno store in memoria, gia migrato, con id deterministici. */
async function nuovoStore(): Promise<DataStore> {
  return openDataStore({ generateId: idDeterministici() })
}

test('migrate da schema vuoto applica la 1 ed e idempotente', async () => {
  const pg = new PGlite()
  await pg.waitReady
  const driver = createPgliteDriver(pg)
  const store = createDataStore(driver, { generateId: idDeterministici() })

  const prima = await store.migrate()
  assert.deepEqual(prima, [1], 'la prima migrazione applica la versione 1')

  const seconda = await store.migrate()
  assert.deepEqual(seconda, [], 'rieseguire non applica nulla')

  await store.close()
})

test('lo schema e riproducibile su due istanze indipendenti', async () => {
  const a = await nuovoStore()
  const b = await nuovoStore()

  const pa = await a.progetti.create({ nome: 'Pratica A' })
  const pb = await b.progetti.create({ nome: 'Pratica B' })

  // Stesso generatore deterministico su schema riprodotto: stesso primo id.
  assert.equal(pa.id, 'id-0001')
  assert.equal(pb.id, 'id-0001')

  await a.close()
  await b.close()
})

test('CRUD del progetto', async () => {
  const store = await nuovoStore()

  const creato = await store.progetti.create({ nome: 'Divorzio Rossi' })
  assert.equal(creato.nome, 'Divorzio Rossi')
  assert.ok(creato.creato_il)
  assert.ok(creato.aggiornato_il >= creato.creato_il)

  const letto = await store.progetti.get(creato.id)
  assert.deepEqual(letto, creato)

  const aggiornato = await store.progetti.update(creato.id, { nome: 'Divorzio Rossi/Bianchi' })
  assert.equal(aggiornato?.nome, 'Divorzio Rossi/Bianchi')
  assert.ok(aggiornato && aggiornato.aggiornato_il >= creato.aggiornato_il)

  const elenco = await store.progetti.list()
  assert.equal(elenco.length, 1)

  assert.equal(await store.progetti.delete(creato.id), true)
  assert.equal(await store.progetti.get(creato.id), null)
  assert.equal(await store.progetti.delete(creato.id), false)

  await store.close()
})

test('il documento appartiene al progetto e cade con esso (CASCADE)', async () => {
  const store = await nuovoStore()
  const progetto = await store.progetti.create({ nome: 'Contenzioso' })

  const doc = await store.documenti.create({
    progetto_id: progetto.id,
    nome: 'atto.pdf',
    formato: 'PDF',
    uri_storage: 'file:///doc/atto.pdf'
  })
  assert.equal(doc.progetto_id, progetto.id)
  assert.deepEqual(doc.versioni, [])

  const perProgetto = await store.documenti.listByProgetto(progetto.id)
  assert.equal(perProgetto.length, 1)

  const patch = await store.documenti.update(doc.id, { versioni: [{ v: 1 }, { v: 2 }] })
  assert.deepEqual(patch?.versioni, [{ v: 1 }, { v: 2 }])

  // Eliminando il progetto, il documento sparisce per integrita referenziale.
  await store.progetti.delete(progetto.id)
  assert.equal(await store.documenti.get(doc.id), null)

  await store.close()
})

test('creare un documento su un progetto inesistente viola la chiave esterna', async () => {
  const store = await nuovoStore()
  await assert.rejects(
    () => store.documenti.create({ progetto_id: 'inesistente', nome: 'x.pdf', formato: 'PDF' }),
    (err: unknown) => err instanceof DataError && err.code === 'FOREIGN_KEY_VIOLATION'
  )
  await store.close()
})

test('la conversazione sopravvive al progetto perdendone il legame (SET NULL)', async () => {
  const store = await nuovoStore()
  const progetto = await store.progetti.create({ nome: 'Consulenza' })

  const conv = await store.conversazioni.create({
    progetto_id: progetto.id,
    titolo: 'Prima domanda'
  })
  assert.equal(conv.progetto_id, progetto.id)

  const senzaProgetto = await store.conversazioni.create({ titolo: 'Senza progetto' })
  assert.equal(senzaProgetto.progetto_id, null)

  await store.progetti.delete(progetto.id)
  const dopo = await store.conversazioni.get(conv.id)
  assert.equal(dopo?.progetto_id, null, 'il legame col progetto si azzera, la conversazione resta')

  await store.close()
})

test('i messaggi si ordinano da soli e conservano le query generate', async () => {
  const store = await nuovoStore()
  const conv = await store.conversazioni.create({ titolo: 'Chat' })

  const m0 = await store.messaggi.create({
    conversazione_id: conv.id,
    ruolo: 'utente',
    contenuto: 'Qual e il termine per impugnare?'
  })
  const m1 = await store.messaggi.create({
    conversazione_id: conv.id,
    ruolo: 'assistente',
    contenuto: 'Dipende dal rito.',
    query_generate: ['termine impugnazione appello', 'art. 325 c.p.c.'],
    citazioni: [{ eli: 'urn:nir:...', articolo: '325' }],
    chunk_usati: [{ id: 'chunk-1' }]
  })

  assert.equal(m0.ordine, 0)
  assert.equal(m1.ordine, 1)
  // Le query pianificate restano tracciabili sul messaggio.
  assert.deepEqual(m1.query_generate, ['termine impugnazione appello', 'art. 325 c.p.c.'])
  assert.deepEqual(m1.citazioni, [{ eli: 'urn:nir:...', articolo: '325' }])

  const elenco = await store.messaggi.listByConversazione(conv.id)
  assert.deepEqual(
    elenco.map((m) => m.ordine),
    [0, 1]
  )

  await store.close()
})

test('la coppia (conversazione, ordine) e unica', async () => {
  const store = await nuovoStore()
  const conv = await store.conversazioni.create({ titolo: 'Chat' })

  await store.messaggi.create({
    conversazione_id: conv.id,
    ordine: 0,
    ruolo: 'utente',
    contenuto: 'Uno'
  })
  await assert.rejects(
    () =>
      store.messaggi.create({
        conversazione_id: conv.id,
        ordine: 0,
        ruolo: 'assistente',
        contenuto: 'Due'
      }),
    (err: unknown) => err instanceof DataError && err.code === 'UNIQUE_VIOLATION'
  )

  await store.close()
})

test('i messaggi cadono con la conversazione (CASCADE)', async () => {
  const store = await nuovoStore()
  const conv = await store.conversazioni.create({ titolo: 'Chat' })
  const msg = await store.messaggi.create({
    conversazione_id: conv.id,
    ruolo: 'utente',
    contenuto: 'Ciao'
  })

  await store.conversazioni.delete(conv.id)
  assert.equal(await store.messaggi.get(msg.id), null)

  await store.close()
})

test('CRUD della chiave API: conserva il valore cifrato e la configurazione', async () => {
  const store = await nuovoStore()

  const chiave = await store.chiaviApi.create({
    provider: 'anthropic',
    valore_cifrato: 'AAAA.cifrato.BBBB',
    configurazione: { modello: 'claude-opus-4-8', base_url: null }
  })
  assert.equal(chiave.valore_cifrato, 'AAAA.cifrato.BBBB')
  assert.deepEqual(chiave.configurazione, { modello: 'claude-opus-4-8', base_url: null })

  const aggiornata = await store.chiaviApi.update(chiave.id, {
    valore_cifrato: 'CCCC.nuovo.DDDD'
  })
  assert.equal(aggiornata?.valore_cifrato, 'CCCC.nuovo.DDDD')
  assert.equal(aggiornata?.provider, 'anthropic')

  const elenco = await store.chiaviApi.list()
  assert.equal(elenco.length, 1)

  assert.equal(await store.chiaviApi.delete(chiave.id), true)
  assert.equal(await store.chiaviApi.get(chiave.id), null)

  await store.close()
})
