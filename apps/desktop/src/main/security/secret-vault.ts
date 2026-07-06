import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmod, mkdir, open, readFile, rename, rm, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export const CURRENT_SECRET_RECORD_SCHEMA = 1
export const SECRET_RECORD_ALGORITHM = 'AES-256-GCM'
export const DEK_BYTES = 32
export const IV_BYTES = 12
export const AUTH_TAG_BYTES = 16

const KEYRING_FILE_NAME = 'secret-keyring.json'
const STRONG_LINUX_BACKENDS = new Set(['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'])

export type SecretRecordAlgorithm = typeof SECRET_RECORD_ALGORITHM

export interface EncryptedSecretRecord {
  versione_schema: typeof CURRENT_SECRET_RECORD_SCHEMA
  algoritmo: SecretRecordAlgorithm
  id_chiave: string
  iv: string
  tag: string
  ciphertext: string
}

export interface WrappedDekRecord {
  versione_schema: 1
  algoritmo_avvolgimento: 'electron-safeStorage'
  id_chiave: string
  dek_avvolta: string
  backend_safe_storage: string | null
  creato_il: string
  aggiornato_il: string
  chiavi_precedenti?: WrappedDekHistoryEntry[]
}

export interface WrappedDekHistoryEntry {
  id_chiave: string
  dek_avvolta: string
  backend_safe_storage: string | null
  creata_il: string
  ritirata_il: string
}

export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
  getSelectedStorageBackend?: () => string
}

export interface LinuxSafeStorageWarning {
  backend: string | null
  message: string
}

export interface SecretVaultOptions {
  userDataPath: string
  safeStorage: SafeStorageAdapter
  platform?: NodeJS.Platform
  keyringFileName?: string
  onLinuxWeakStorage?: (warning: LinuxSafeStorageWarning) => void
}

export interface DekRotationResult {
  id_chiave: string
  records: EncryptedSecretRecord[]
}

interface PlainDek {
  id_chiave: string
  dek: Buffer
}

interface PlainPreviousDek extends PlainDek {
  creata_il: string
  ritirata_il: string
}

interface PlainKeyring {
  record: WrappedDekRecord
  active: PlainDek
  previous: PlainPreviousDek[]
}

export class SecretVaultError extends Error {
  public readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'SecretVaultError'
    this.code = code
  }
}

export class SecretVault {
  private readonly keyringPath: string
  private readonly safeStorage: SafeStorageAdapter
  private readonly platform: NodeJS.Platform
  private readonly onLinuxWeakStorage?: (warning: LinuxSafeStorageWarning) => void
  private cachedDek: Buffer | null = null
  private cachedKeyId: string | null = null
  private cachedDeks = new Map<string, Buffer>()
  private initPromise: Promise<{ dek: Buffer; id_chiave: string }> | null = null
  private keyringMutation: Promise<unknown> = Promise.resolve()
  private linuxWarningEmitted = false

  constructor(options: SecretVaultOptions) {
    this.keyringPath = join(options.userDataPath, options.keyringFileName ?? KEYRING_FILE_NAME)
    this.safeStorage = options.safeStorage
    this.platform = options.platform ?? process.platform
    this.onLinuxWeakStorage = options.onLinuxWeakStorage
  }

  checkLinuxStorageProtection(): LinuxSafeStorageWarning | null {
    if (this.platform !== 'linux') {
      return null
    }

    const backend = this.getSelectedStorageBackend()
    const isStrong = backend !== null && STRONG_LINUX_BACKENDS.has(backend)

    if (this.safeStorage.isEncryptionAvailable() && isStrong) {
      return null
    }

    return {
      backend,
      message:
        'Il portachiavi di sistema non e disponibile o safeStorage usa un backend debole. I segreti restano cifrati, ma la protezione forte richiede Secret Service/libsecret o KWallet.'
    }
  }

  emitLinuxStorageWarningIfNeeded(): LinuxSafeStorageWarning | null {
    if (this.linuxWarningEmitted) {
      return null
    }

    const warning = this.checkLinuxStorageProtection()
    if (!warning) {
      return null
    }

    this.linuxWarningEmitted = true
    this.onLinuxWeakStorage?.(warning)
    return warning
  }

  async encryptSecret(secret: string): Promise<EncryptedSecretRecord> {
    const { dek, id_chiave } = await this.runKeyringMutation(() => this.loadOrCreateDek())
    return encryptSecretWithDek(secret, dek, id_chiave)
  }

  async decryptSecret(record: EncryptedSecretRecord): Promise<string> {
    const dek = await this.loadDekById(record.id_chiave)
    return decryptSecretWithDek(record, dek)
  }

  async rotateKek(): Promise<WrappedDekRecord> {
    return this.runKeyringMutation(async () => {
      const keyring = await this.loadPlainKeyring()
      return this.writeWrappedDek(
        keyring.active.dek,
        keyring.active.id_chiave,
        keyring.previous,
        keyring.record
      )
    })
  }

  async rotateDek(records: EncryptedSecretRecord[]): Promise<DekRotationResult> {
    return this.runKeyringMutation(async () => {
      const keyring = await this.loadPlainKeyring()
      const oldDek = keyring.active
      const plainTexts = records.map((record) => {
        if (record.id_chiave !== oldDek.id_chiave) {
          throw new SecretVaultError(
            'La rotazione DEK richiede record cifrati con la chiave attiva.',
            'KEY_ID_MISMATCH'
          )
        }

        return decryptSecretWithDek(record, oldDek.dek)
      })

      const nextDek = randomBytes(DEK_BYTES)
      const nextKeyId = createKeyId()
      await this.writeWrappedDek(
        nextDek,
        nextKeyId,
        [
          {
            id_chiave: oldDek.id_chiave,
            dek: oldDek.dek,
            creata_il: keyring.record.creato_il,
            ritirata_il: new Date().toISOString()
          },
          ...keyring.previous
        ],
        null
      )
      this.cachedDek = Buffer.from(nextDek)
      this.cachedKeyId = nextKeyId
      this.cachedDeks.set(nextKeyId, Buffer.from(nextDek))
      this.cachedDeks.set(oldDek.id_chiave, Buffer.from(oldDek.dek))

      return {
        id_chiave: nextKeyId,
        records: plainTexts.map((plainText) => encryptSecretWithDek(plainText, nextDek, nextKeyId))
      }
    })
  }

  async revokeDek(): Promise<void> {
    await this.runKeyringMutation(async () => {
      this.cachedDek = null
      this.cachedKeyId = null
      this.cachedDeks.clear()
      this.initPromise = null
      await rm(this.keyringPath, { force: true })
    })
  }

  async getWrappedDekRecord(): Promise<WrappedDekRecord | null> {
    return this.readWrappedDek()
  }

  private async loadOrCreateDek(): Promise<{ dek: Buffer; id_chiave: string }> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.doLoadOrCreateDek().finally(() => {
      this.initPromise = null
    })

    return this.initPromise
  }

  private runKeyringMutation<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.keyringMutation.then(operation, operation)
    this.keyringMutation = run.catch(() => undefined)
    return run
  }

  private async doLoadOrCreateDek(): Promise<{ dek: Buffer; id_chiave: string }> {
    if (this.cachedDek && this.cachedKeyId) {
      return { dek: Buffer.from(this.cachedDek), id_chiave: this.cachedKeyId }
    }

    this.emitLinuxStorageWarningIfNeeded()

    const wrapped = await this.readWrappedDek()

    if (wrapped) {
      const keyring = this.unwrapKeyring(wrapped)
      const dek = keyring.active.dek
      this.cachePlainKeyring(keyring)
      this.cachedKeyId = wrapped.id_chiave
      return { dek, id_chiave: wrapped.id_chiave }
    }

    const dek = randomBytes(DEK_BYTES)
    const id_chiave = createKeyId()
    await this.writeWrappedDek(dek, id_chiave, [], null)
    this.cachedDek = Buffer.from(dek)
    this.cachedKeyId = id_chiave
    this.cachedDeks.set(id_chiave, Buffer.from(dek))
    return { dek, id_chiave }
  }

  private async loadDekById(id_chiave: string): Promise<Buffer> {
    const cached = this.cachedDeks.get(id_chiave)
    if (cached) {
      return Buffer.from(cached)
    }

    const keyring = await this.loadPlainKeyring()
    const found =
      keyring.active.id_chiave === id_chiave
        ? keyring.active
        : keyring.previous.find((entry) => entry.id_chiave === id_chiave)

    if (!found) {
      throw new SecretVaultError(
        'Il record usa una chiave dati non presente nel keyring locale.',
        'KEY_ID_NOT_FOUND'
      )
    }

    return Buffer.from(found.dek)
  }

  private async loadPlainKeyring(): Promise<PlainKeyring> {
    const wrapped = await this.readWrappedDek()

    if (!wrapped) {
      throw new SecretVaultError(
        'Il keyring dei segreti non esiste: impossibile decifrare senza la DEK originale.',
        'KEYRING_MISSING'
      )
    }

    const keyring = this.unwrapKeyring(wrapped)
    this.cachePlainKeyring(keyring)
    return keyring
  }

  private unwrapKeyring(record: WrappedDekRecord): PlainKeyring {
    return {
      record,
      active: {
        id_chiave: record.id_chiave,
        dek: this.unwrapDek(record.dek_avvolta)
      },
      previous: (record.chiavi_precedenti ?? []).map((entry) => ({
        id_chiave: entry.id_chiave,
        dek: this.unwrapDek(entry.dek_avvolta),
        creata_il: entry.creata_il,
        ritirata_il: entry.ritirata_il
      }))
    }
  }

  private cachePlainKeyring(keyring: PlainKeyring): void {
    this.cachedDek = Buffer.from(keyring.active.dek)
    this.cachedKeyId = keyring.active.id_chiave
    this.cachedDeks.set(keyring.active.id_chiave, Buffer.from(keyring.active.dek))

    for (const entry of keyring.previous) {
      this.cachedDeks.set(entry.id_chiave, Buffer.from(entry.dek))
    }
  }

  private unwrapDek(wrappedDek: string): Buffer {
    let dek: Buffer

    try {
      const encryptedDek = Buffer.from(wrappedDek, 'base64')
      const plainDekBase64 = this.safeStorage.decryptString(encryptedDek)
      dek = Buffer.from(plainDekBase64, 'base64')
    } catch {
      throw new SecretVaultError('La DEK avvolta non puo essere decifrata.', 'DEK_UNWRAP_FAILED')
    }

    if (dek.byteLength !== DEK_BYTES) {
      throw new SecretVaultError('La DEK salvata non ha lunghezza valida.', 'INVALID_DEK')
    }

    return dek
  }

  private async writeWrappedDek(
    dek: Buffer,
    id_chiave: string,
    previousKeys: PlainPreviousDek[],
    previous: WrappedDekRecord | null
  ): Promise<WrappedDekRecord> {
    if (!this.safeStorage.isEncryptionAvailable()) {
      throw new SecretVaultError(
        'safeStorage non e disponibile per proteggere la DEK.',
        'SAFE_STORAGE_UNAVAILABLE'
      )
    }

    const now = new Date().toISOString()
    const encryptedDek = this.wrapAndVerifyDek(dek)
    const record: WrappedDekRecord = {
      versione_schema: 1,
      algoritmo_avvolgimento: 'electron-safeStorage',
      id_chiave,
      dek_avvolta: encryptedDek.toString('base64'),
      backend_safe_storage: this.getSelectedStorageBackend(),
      creato_il: previous?.creato_il ?? now,
      aggiornato_il: now,
      chiavi_precedenti: previousKeys.map((entry) => ({
        id_chiave: entry.id_chiave,
        dek_avvolta: this.wrapAndVerifyDek(entry.dek).toString('base64'),
        backend_safe_storage: this.getSelectedStorageBackend(),
        creata_il: entry.creata_il,
        ritirata_il: entry.ritirata_il
      }))
    }

    await writeJsonAtomically(this.keyringPath, record)
    return record
  }

  private wrapAndVerifyDek(dek: Buffer): Buffer {
    const encryptedDek = this.safeStorage.encryptString(dek.toString('base64'))
    const unwrapped = this.unwrapDek(encryptedDek.toString('base64'))

    if (!secureBufferEquals(dek, unwrapped)) {
      throw new SecretVaultError(
        'Verifica del wrapping della DEK fallita.',
        'DEK_WRAP_VERIFICATION_FAILED'
      )
    }

    return encryptedDek
  }

  private async readWrappedDek(): Promise<WrappedDekRecord | null> {
    try {
      const raw = await readFile(this.keyringPath, 'utf8')
      return parseWrappedDekRecord(parseKeyringJson(raw))
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null
      }

      throw error
    }
  }

  private getSelectedStorageBackend(): string | null {
    return this.safeStorage.getSelectedStorageBackend?.() ?? null
  }
}

export function encryptSecretWithDek(
  secret: string,
  dek: Buffer,
  id_chiave: string
): EncryptedSecretRecord {
  assertDek(dek)

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', dek, iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    versione_schema: CURRENT_SECRET_RECORD_SCHEMA,
    algoritmo: SECRET_RECORD_ALGORITHM,
    id_chiave,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  }
}

export function decryptSecretWithDek(record: EncryptedSecretRecord, dek: Buffer): string {
  assertDek(dek)
  assertEncryptedSecretRecord(record)

  const iv = Buffer.from(record.iv, 'base64')
  const tag = Buffer.from(record.tag, 'base64')
  const ciphertext = Buffer.from(record.ciphertext, 'base64')

  if (iv.byteLength !== IV_BYTES) {
    throw new SecretVaultError('IV non valido per AES-256-GCM.', 'INVALID_IV')
  }

  if (tag.byteLength !== AUTH_TAG_BYTES) {
    throw new SecretVaultError('Auth tag non valido per AES-256-GCM.', 'INVALID_AUTH_TAG')
  }

  const decipher = createDecipheriv('aes-256-gcm', dek, iv)
  decipher.setAuthTag(tag)

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    throw new SecretVaultError(
      'Decifratura fallita: record assente, corrotto o manomesso.',
      'DECRYPTION_FAILED'
    )
  }
}

export function isStrongLinuxSafeStorageBackend(backend: string | null): boolean {
  return backend !== null && STRONG_LINUX_BACKENDS.has(backend)
}

function createKeyId(): string {
  return `dek_${randomBytes(16).toString('hex')}`
}

function assertDek(dek: Buffer): void {
  if (dek.byteLength !== DEK_BYTES) {
    throw new SecretVaultError('La DEK deve essere una chiave casuale a 256 bit.', 'INVALID_DEK')
  }
}

function assertEncryptedSecretRecord(record: EncryptedSecretRecord): void {
  if (record.versione_schema !== CURRENT_SECRET_RECORD_SCHEMA) {
    throw new SecretVaultError(
      'Versione schema del record cifrato non supportata.',
      'UNSUPPORTED_SCHEMA'
    )
  }

  if (record.algoritmo !== SECRET_RECORD_ALGORITHM) {
    throw new SecretVaultError(
      'Algoritmo del record cifrato non supportato.',
      'UNSUPPORTED_ALGORITHM'
    )
  }
}

function parseKeyringJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    throw new SecretVaultError(
      'Il file keyring dei segreti e corrotto o incompleto.',
      'INVALID_KEYRING_FILE'
    )
  }
}

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  const directory = dirname(filePath)
  const fileName = basename(filePath)
  const tempPath = join(
    directory,
    `.${fileName}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`
  )
  const payload = `${JSON.stringify(value, null, 2)}\n`
  let handle: Awaited<ReturnType<typeof open>> | null = null

  await mkdir(directory, { recursive: true })

  try {
    handle = await open(tempPath, 'wx', 0o600)
    await handle.writeFile(payload, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    await chmod(tempPath, 0o600)
    await rename(tempPath, filePath)
    await chmod(filePath, 0o600)
    await syncDirectoryBestEffort(directory)
  } catch (error) {
    if (handle) {
      await handle.close()
    }

    await unlink(tempPath).catch(() => undefined)
    throw error
  }
}

async function syncDirectoryBestEffort(directory: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | null = null

  try {
    handle = await open(directory, 'r')
    await handle.sync()
  } catch {
    // Alcune piattaforme non permettono fsync sulle directory.
  } finally {
    if (handle) {
      await handle.close()
    }
  }
}

function parseWrappedDekRecord(value: unknown): WrappedDekRecord {
  if (!isWrappedDekRecord(value)) {
    throw new SecretVaultError('Record della DEK avvolta non valido.', 'INVALID_WRAPPED_DEK_RECORD')
  }

  return value
}

function isWrappedDekRecord(value: unknown): value is WrappedDekRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record['versione_schema'] === 1 &&
    record['algoritmo_avvolgimento'] === 'electron-safeStorage' &&
    typeof record['id_chiave'] === 'string' &&
    typeof record['dek_avvolta'] === 'string' &&
    (typeof record['backend_safe_storage'] === 'string' ||
      record['backend_safe_storage'] === null) &&
    typeof record['creato_il'] === 'string' &&
    typeof record['aggiornato_il'] === 'string' &&
    (record['chiavi_precedenti'] === undefined ||
      (Array.isArray(record['chiavi_precedenti']) &&
        record['chiavi_precedenti'].every(isWrappedDekHistoryEntry)))
  )
}

function isWrappedDekHistoryEntry(value: unknown): value is WrappedDekHistoryEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record['id_chiave'] === 'string' &&
    typeof record['dek_avvolta'] === 'string' &&
    (typeof record['backend_safe_storage'] === 'string' ||
      record['backend_safe_storage'] === null) &&
    typeof record['creata_il'] === 'string' &&
    typeof record['ritirata_il'] === 'string'
  )
}

export function secureBufferEquals(left: Buffer, right: Buffer): boolean {
  return left.byteLength === right.byteLength && timingSafeEqual(left, right)
}
