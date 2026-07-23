import assert from 'node:assert/strict'
import { test } from 'node:test'

import { OperationError } from '@magistra/shared'

import { createCore, type ProviderSettingsService } from '../src/index.ts'

// Il core si esercita senza Electron: qui non si importa nulla del trasporto.
// Questi test provano il contratto tipizzato e la validazione ai confini.

test('operations.echo rimbalza il messaggio (invocazione diretta, senza IPC)', () => {
  const core = createCore()
  const result = core.operations.echo({ message: 'ciao' })
  assert.deepEqual(result, { message: 'ciao' })
})

test('invoke valida la richiesta e rimbalza la risposta validata', async () => {
  const core = createCore()
  const result = await core.invoke('echo', { message: 'ping' })
  assert.deepEqual(result, { message: 'ping' })
})

test('invoke rifiuta una richiesta non valida con INVALID_REQUEST', async () => {
  const core = createCore()
  await assert.rejects(
    () => core.invoke('echo', { message: 42 }),
    (error: unknown) => {
      assert.ok(error instanceof OperationError)
      assert.equal(error.code, 'INVALID_REQUEST')
      return true
    }
  )
})

test('il messaggio di una richiesta non valida e leggibile, non un dump JSON', async () => {
  const core = createCore()
  await assert.rejects(
    () => core.invoke('echo', { message: 42 }),
    (error: unknown) => {
      assert.ok(error instanceof OperationError)
      // Finisce sotto gli occhi dell'utente nel banner d'errore della UI.
      assert.doesNotMatch(error.message, /[{[]/, 'niente JSON nel messaggio')
      assert.match(error.message, /message: /)
      return true
    }
  )
})

test('un percorso con caratteri di controllo non inietta a capo nel messaggio', async () => {
  const core = createCore()
  await assert.rejects(
    () =>
      core.invoke('providerSave', {
        kind: 'openai-compatible',
        baseUrl: 'https://gpu.studio.local/v1',
        headers: { 'X-Buono\r\nX-Iniettato': 'v' }
      }),
    (error: unknown) => {
      assert.ok(error instanceof OperationError)
      assert.doesNotMatch(error.message, /[\r\n]/, 'il messaggio resta su una riga')
      assert.match(error.message, /Nome di header HTTP non valido/)
      return true
    }
  )
})

test('invoke rifiuta un payload assente con INVALID_REQUEST', async () => {
  const core = createCore()
  await assert.rejects(
    () => core.invoke('echo', undefined),
    (error: unknown) => error instanceof OperationError && error.code === 'INVALID_REQUEST'
  )
})

test("invoke rifiuta un'operazione fuori dal contratto con UNKNOWN_OPERATION", async () => {
  const core = createCore()
  await assert.rejects(
    // @ts-expect-error operazione volutamente fuori dal contratto tipizzato
    () => core.invoke('nope', {}),
    (error: unknown) => error instanceof OperationError && error.code === 'UNKNOWN_OPERATION'
  )
})

test('le operazioni non ancora implementate rispondono NOT_IMPLEMENTED', async () => {
  const core = createCore()
  await assert.rejects(
    () => core.invoke('chat', { message: 'domanda' }),
    (error: unknown) => error instanceof OperationError && error.code === 'NOT_IMPLEMENTED'
  )
})

test('senza servizio iniettato, la gestione API key risponde NOT_IMPLEMENTED', async () => {
  const core = createCore()
  await assert.rejects(
    () => core.invoke('providerList', {}),
    (error: unknown) => error instanceof OperationError && error.code === 'NOT_IMPLEMENTED'
  )
})

test('con un servizio iniettato, le operazioni provider delegano ad esso', async () => {
  const vista = {
    id: 'p1',
    kind: 'anthropic' as const,
    nome: null,
    baseUrl: null,
    generationModel: 'claude-sonnet-5',
    embeddingModel: null,
    timeoutMs: null,
    privacy: 'standard' as const,
    haChiave: true,
    numeroHeader: 0,
    attivo: true,
    creata_il: '2026-01-01T00:00:00Z',
    aggiornata_il: '2026-01-01T00:00:00Z'
  }
  const providerSettings: ProviderSettingsService = {
    list: async () => [vista],
    save: async () => vista,
    remove: async () => true,
    activate: async () => vista,
    testConnection: async () => ({ stato: 'ok', messaggio: 'Provider raggiungibile.' })
  }
  const core = createCore({ providerSettings })

  assert.deepEqual(await core.invoke('providerList', {}), { providers: [vista] })
  assert.deepEqual(await core.invoke('providerDelete', { id: 'p1' }), { deleted: true })
  assert.deepEqual(await core.invoke('providerTest', { id: 'p1' }), {
    stato: 'ok',
    messaggio: 'Provider raggiungibile.'
  })
})
