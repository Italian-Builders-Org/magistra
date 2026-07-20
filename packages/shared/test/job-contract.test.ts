import assert from 'node:assert/strict'
import test from 'node:test'

import {
  jobConteggiSchema,
  jobProgressSchema,
  jobStatoSchema,
  jobSummarySchema
} from '../src/index.ts'

const CONTEGGI = {
  elaborati: 3,
  ok: 1,
  parziali: 1,
  inQuarantena: 1,
  totale: 10
}

test('jobStatoSchema accetta solo i due stati terminali', () => {
  assert.equal(jobStatoSchema.parse('completato'), 'completato')
  assert.equal(jobStatoSchema.parse('completato_con_quarantena'), 'completato_con_quarantena')
  assert.equal(jobStatoSchema.safeParse('in_corso').success, false)
})

test('jobConteggiSchema ammette un totale nullo ma non conteggi negativi', () => {
  assert.equal(jobConteggiSchema.parse({ ...CONTEGGI, totale: null }).totale, null)
  assert.equal(jobConteggiSchema.safeParse({ ...CONTEGGI, ok: -1 }).success, false)
  assert.equal(jobConteggiSchema.safeParse({ ...CONTEGGI, ok: 1.5 }).success, false)
})

test('jobProgressSchema unisce i metadati del job ai conteggi', () => {
  const progress = jobProgressSchema.parse({ jobId: 'ingest-1', tipo: 'ingest', ...CONTEGGI })

  assert.equal(progress.jobId, 'ingest-1')
  assert.equal(progress.tipo, 'ingest')
  assert.equal(progress.elaborati, 3)
  assert.equal(
    jobProgressSchema.safeParse({ jobId: '', tipo: 'ingest', ...CONTEGGI }).success,
    false
  )
})

test('jobSummarySchema aggiunge lo stato terminale al progresso', () => {
  const summary = jobSummarySchema.parse({
    jobId: 'ingest-1',
    tipo: 'ingest',
    stato: 'completato_con_quarantena',
    ...CONTEGGI
  })

  assert.equal(summary.stato, 'completato_con_quarantena')
  assert.equal(
    jobSummarySchema.safeParse({ jobId: 'ingest-1', tipo: 'ingest', ...CONTEGGI }).success,
    false
  )
})
