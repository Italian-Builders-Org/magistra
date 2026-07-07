import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
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
  public corruptNextEncryption = false

  constructor(available = true, backend = 'gnome_libsecret') {
    this.available = available
    this.backend = backend
  }

  isEncryptionAvailable(): boolean {
    return this.available
  }

  encryptString(plainText: string): Buffer {
    if (this.corruptNextEncryption) {
      this.corruptNextEncryption = false
      return randomBytes(IV_BYTES + AUTH_TAG_BYTES + 8)
    }

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

test('serializza la creazione della DEK al primo avvio concorrente', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const vault = new SecretVault({ userDataPath, safeStorage: new MockSafeStorage() })

  const [firstRecord, secondRecord] = await Promise.all([
    vault.encryptSecret('sk-primo-segreto'),
    vault.encryptSecret('sk-secondo-segreto')
  ])

  assert.equal(firstRecord.id_chiave, secondRecord.id_chiave)
  assert.equal(await vault.decryptSecret(firstRecord), 'sk-primo-segreto')
  assert.equal(await vault.decryptSecret(secondRecord), 'sk-secondo-segreto')
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
  assert.equal((await stat(join(userDataPath, 'secret-keyring.json'))).mode & 0o777, 0o600)
})

test('non crea una nuova DEK quando decifra senza keyring', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const safeStorage = new MockSafeStorage()
  const vault = new SecretVault({ userDataPath, safeStorage })
  const record = await vault.encryptSecret('sk-test-segreto')
  const keyringPath = join(userDataPath, 'secret-keyring.json')

  await rm(keyringPath)

  const coldVault = new SecretVault({ userDataPath, safeStorage })
  await assert.rejects(
    coldVault.decryptSecret(record),
    (error) => error instanceof SecretVaultError && error.code === 'KEYRING_MISSING'
  )
  await assert.rejects(readFile(keyringPath, 'utf8'), { code: 'ENOENT' })
})

test('segnala esplicitamente un keyring troncato o corrotto', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const safeStorage = new MockSafeStorage()
  const vault = new SecretVault({ userDataPath, safeStorage })
  const record = await vault.encryptSecret('sk-test-segreto')
  const keyringPath = join(userDataPath, 'secret-keyring.json')
  const keyringFile = await readFile(keyringPath, 'utf8')

  await writeFile(keyringPath, keyringFile.slice(0, Math.floor(keyringFile.length / 2)), 'utf8')

  const coldVault = new SecretVault({ userDataPath, safeStorage })
  await assert.rejects(
    coldVault.decryptSecret(record),
    (error) => error instanceof SecretVaultError && error.code === 'INVALID_KEYRING_FILE'
  )
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

test('la rotazione DEK conserva la chiave precedente per record non ancora ricifrati', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const safeStorage = new MockSafeStorage()
  const vault = new SecretVault({ userDataPath, safeStorage })

  const firstRecord = await vault.encryptSecret('sk-primo-segreto')
  const secondRecord = await vault.encryptSecret('sk-secondo-segreto')
  const rotated = await vault.rotateDek([firstRecord])
  const coldVault = new SecretVault({ userDataPath, safeStorage })

  assert.equal(await coldVault.decryptSecret(rotated.records[0]), 'sk-primo-segreto')
  assert.equal(await coldVault.decryptSecret(secondRecord), 'sk-secondo-segreto')
})

test('serializza rotazioni DEK concorrenti senza perdere record esistenti', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const safeStorage = new MockSafeStorage()
  const vault = new SecretVault({ userDataPath, safeStorage })
  const firstRecord = await vault.encryptSecret('sk-primo-segreto')
  const secondRecord = await vault.encryptSecret('sk-secondo-segreto')

  const [firstRotation, secondRotation] = await Promise.allSettled([
    vault.rotateDek([firstRecord]),
    vault.rotateDek([secondRecord])
  ])

  assert.equal(firstRotation.status, 'fulfilled')
  assert.equal(secondRotation.status, 'rejected')
  assert.ok(secondRotation.reason instanceof SecretVaultError)
  assert.equal(secondRotation.reason.code, 'KEY_ID_MISMATCH')
  const coldVault = new SecretVault({ userDataPath, safeStorage })
  assert.equal(await coldVault.decryptSecret(firstRotation.value.records[0]), 'sk-primo-segreto')
  assert.equal(await coldVault.decryptSecret(secondRecord), 'sk-secondo-segreto')
})

test('rotateKek verifica il nuovo wrapping prima di sostituire il keyring', async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), 'magistra-secrets-'))
  const safeStorage = new MockSafeStorage()
  const vault = new SecretVault({ userDataPath, safeStorage })
  const record = await vault.encryptSecret('sk-test-segreto')
  const keyringPath = join(userDataPath, 'secret-keyring.json')
  const keyringBefore = await readFile(keyringPath, 'utf8')

  safeStorage.corruptNextEncryption = true

  await assert.rejects(
    vault.rotateKek(),
    (error) => error instanceof SecretVaultError && error.code === 'DEK_UNWRAP_FAILED'
  )
  assert.equal(await readFile(keyringPath, 'utf8'), keyringBefore)

  const coldVault = new SecretVault({ userDataPath, safeStorage })
  assert.equal(await coldVault.decryptSecret(record), 'sk-test-segreto')
})
