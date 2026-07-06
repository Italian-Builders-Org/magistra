import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AUTH_TAG_BYTES,
  DEK_BYTES,
  IV_BYTES,
  SecretVault,
  SecretVaultError,
  type SafeStorageAdapter
} from '../../src/main/security/secret-vault.ts'

class MockSafeStorage implements SafeStorageAdapter {
  private readonly kek = randomBytes(DEK_BYTES)
  private readonly available: boolean
  private readonly backend: string

  constructor(available = true, backend = 'gnome_libsecret') {
    this.available = available
    this.backend = backend
  }

  isEncryptionAvailable(): boolean {
    return this.available
  }

  encryptString(plainText: string): Buffer {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv('aes-256-gcm', this.kek, iv, { authTagLength: AUTH_TAG_BYTES })
    const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
  }

  decryptString(encrypted: Buffer): string {
    const iv = encrypted.subarray(0, IV_BYTES)
    const tag = encrypted.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES)
    const ciphertext = encrypted.subarray(IV_BYTES + AUTH_TAG_BYTES)
    const decipher = createDecipheriv('aes-256-gcm', this.kek, iv, {
      authTagLength: AUTH_TAG_BYTES
    })
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  }

  getSelectedStorageBackend(): string {
    return this.backend
  }
}

test('cifra e decifra un segreto in round-trip', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const vault = new SecretVault({ userDataPath, safeStorage: new MockSafeStorage() })

  const record = await vault.encryptSecret('sk-test-segreto')
  const decrypted = await vault.decryptSecret(record)

  assert.equal(decrypted, 'sk-test-segreto')
  assert.equal(record.versione_schema, 1)
  assert.equal(record.algoritmo, 'AES-256-GCM')
  assert.equal(Buffer.from(record.iv, 'base64').byteLength, IV_BYTES)
  assert.equal(Buffer.from(record.tag, 'base64').byteLength, AUTH_TAG_BYTES)
})

test('rileva una manomissione del ciphertext in decifratura', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const vault = new SecretVault({ userDataPath, safeStorage: new MockSafeStorage() })

  const record = await vault.encryptSecret('sk-test-segreto')
  const tamperedCiphertext = Buffer.from(record.ciphertext, 'base64')
  tamperedCiphertext[0] = tamperedCiphertext[0] ^ 0xff

  await assert.rejects(
    vault.decryptSecret({ ...record, ciphertext: tamperedCiphertext.toString('base64') }),
    (error) => error instanceof SecretVaultError && error.code === 'DECRYPTION_FAILED'
  )
})

test('rileva una manomissione dell auth tag in decifratura', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const vault = new SecretVault({ userDataPath, safeStorage: new MockSafeStorage() })

  const record = await vault.encryptSecret('sk-test-segreto')
  const tamperedTag = Buffer.from(record.tag, 'base64')
  tamperedTag[0] = tamperedTag[0] ^ 0xff

  await assert.rejects(
    vault.decryptSecret({ ...record, tag: tamperedTag.toString('base64') }),
    (error) => error instanceof SecretVaultError && error.code === 'DECRYPTION_FAILED'
  )
})

test('non salva la DEK in chiaro su disco', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const vault = new SecretVault({ userDataPath, safeStorage: new MockSafeStorage() })

  await vault.encryptSecret('sk-test-segreto')
  const keyring = await vault.getWrappedDekRecord()
  assert.ok(keyring)

  const keyringFile = await readFile(join(userDataPath, 'secret-keyring.json'), 'utf8')
  assert.doesNotMatch(keyringFile, /sk-test-segreto/)
  assert.doesNotMatch(keyringFile, /"dek"\s*:/)
  assert.match(keyringFile, /"dek_avvolta"\s*:/)
})

test('avvisa su Linux quando safeStorage usa un backend debole', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const warnings: string[] = []
  const vault = new SecretVault({
    userDataPath,
    safeStorage: new MockSafeStorage(true, 'basic_text'),
    platform: 'linux',
    onLinuxWeakStorage: (warning) => warnings.push(warning.backend ?? 'none')
  })

  await vault.encryptSecret('sk-test-segreto')

  assert.deepEqual(warnings, ['basic_text'])
})

test('emette l avviso Linux debole una sola volta', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const warnings: string[] = []
  const vault = new SecretVault({
    userDataPath,
    safeStorage: new MockSafeStorage(true, 'basic_text'),
    platform: 'linux',
    onLinuxWeakStorage: (warning) => warnings.push(warning.backend ?? 'none')
  })

  vault.emitLinuxStorageWarningIfNeeded()
  await vault.encryptSecret('sk-test-segreto')

  assert.deepEqual(warnings, ['basic_text'])
})

test('ruota la KEK ri-avvolgendo la stessa DEK e ruota la DEK ricifrando i record', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const vault = new SecretVault({ userDataPath, safeStorage: new MockSafeStorage() })

  const firstRecord = await vault.encryptSecret('sk-test-segreto')
  const firstKeyring = await vault.getWrappedDekRecord()
  const rewrappedKeyring = await vault.rotateKek()
  const rotated = await vault.rotateDek([firstRecord])

  assert.ok(firstKeyring)
  assert.equal(firstKeyring.id_chiave, rewrappedKeyring.id_chiave)
  assert.notEqual(firstKeyring.dek_avvolta, rewrappedKeyring.dek_avvolta)
  assert.notEqual(rotated.id_chiave, firstRecord.id_chiave)
  assert.equal(await vault.decryptSecret(rotated.records[0]), 'sk-test-segreto')
})
