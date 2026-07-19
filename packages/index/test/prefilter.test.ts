import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPrefilter } from '../src/prefilter.ts'
import { IndexError } from '../src/errors.ts'

test('buildPrefilter senza vincoli restituisce null', () => {
  assert.equal(buildPrefilter({}), null)
  assert.equal(buildPrefilter({ tipoAtto: [] }), null)
})

test('buildPrefilter traduce la vigenza in un intervallo con estremo superiore aperto', () => {
  const clause = buildPrefilter({ vigenteAl: '2021-06-01' })
  assert.equal(
    clause,
    "vigenza_da <= '2021-06-01' AND (vigenza_a IS NULL OR vigenza_a >= '2021-06-01')"
  )
})

test('buildPrefilter usa uguaglianza per un solo tipo atto e IN per più valori', () => {
  assert.equal(buildPrefilter({ tipoAtto: 'legge' }), "tipo_atto = 'legge'")
  assert.equal(
    buildPrefilter({ tipoAtto: ['legge', 'decreto-legge'] }),
    "tipo_atto IN ('legge', 'decreto-legge')"
  )
})

test('buildPrefilter combina vigenza, tipo atto e fonte con AND', () => {
  const clause = buildPrefilter({
    vigenteAl: '2022-01-01',
    tipoAtto: 'legge',
    fonte: 'normattiva'
  })
  assert.equal(
    clause,
    "vigenza_da <= '2022-01-01' AND (vigenza_a IS NULL OR vigenza_a >= '2022-01-01') " +
      "AND tipo_atto = 'legge' AND fonte = 'normattiva'"
  )
})

test('buildPrefilter fa escaping degli apici nei letterali (niente SQL injection)', () => {
  assert.equal(buildPrefilter({ tipoAtto: "l'atto" }), "tipo_atto = 'l''atto'")
  assert.equal(buildPrefilter({ fonte: "x' OR '1'='1" }), "fonte = 'x'' OR ''1''=''1'")
})

test('buildPrefilter rifiuta una data di vigenza non ISO', () => {
  assert.throws(
    () => buildPrefilter({ vigenteAl: '01/06/2021' }),
    (err: unknown) => err instanceof IndexError && err.code === 'INVALID_FILTER'
  )
})
