import assert from 'node:assert/strict'
import { test } from 'node:test'

import { OperationError } from '@magistra/shared'

import { createCore } from '../src/index.ts'

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
