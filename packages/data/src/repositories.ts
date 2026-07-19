import { z } from 'zod'

import type { SqlDriver, SqlExecutor } from './driver.ts'
import { DataError } from './errors.ts'
import {
  chiaveApiSchema,
  conversazioneSchema,
  documentoSchema,
  messaggioSchema,
  nuovaChiaveApiSchema,
  nuovaConversazioneSchema,
  nuovoDocumentoSchema,
  nuovoMessaggioSchema,
  nuovoProgettoSchema,
  patchChiaveApiSchema,
  patchConversazioneSchema,
  patchDocumentoSchema,
  patchMessaggioSchema,
  patchProgettoSchema,
  progettoSchema,
  type ChiaveApi,
  type Conversazione,
  type Documento,
  type Messaggio,
  type NuovaChiaveApi,
  type NuovaConversazione,
  type NuovoDocumento,
  type NuovoMessaggio,
  type NuovoProgetto,
  type PatchChiaveApi,
  type PatchConversazione,
  type PatchDocumento,
  type PatchMessaggio,
  type PatchProgetto,
  type Progetto
} from './types.ts'

// Repository delle entita applicative.
//
// Ogni entita ha un repository con le operazioni CRUD, dietro un'interfaccia
// tipizzata: e l'unico punto da cui la logica di dominio tocca i dati, mai il
// motore. Le query usano il dialetto Postgres standard con parametri
// posizionali; i valori JSON viaggiano come stringa con cast esplicito
// `::jsonb`, cosi la serializzazione non dipende dal motore.

// === Interfacce dei repository ===============================================

/** CRUD dei progetti. */
export interface ProgettoRepository {
  create(input: NuovoProgetto): Promise<Progetto>
  get(id: string): Promise<Progetto | null>
  list(): Promise<Progetto[]>
  update(id: string, patch: PatchProgetto): Promise<Progetto | null>
  delete(id: string): Promise<boolean>
}

/** CRUD dei documenti, elencabili per progetto. */
export interface DocumentoRepository {
  create(input: NuovoDocumento): Promise<Documento>
  get(id: string): Promise<Documento | null>
  listByProgetto(progettoId: string): Promise<Documento[]>
  update(id: string, patch: PatchDocumento): Promise<Documento | null>
  delete(id: string): Promise<boolean>
}

/** CRUD delle conversazioni, elencabili globalmente o per progetto. */
export interface ConversazioneRepository {
  create(input: NuovaConversazione): Promise<Conversazione>
  get(id: string): Promise<Conversazione | null>
  list(): Promise<Conversazione[]>
  listByProgetto(progettoId: string): Promise<Conversazione[]>
  update(id: string, patch: PatchConversazione): Promise<Conversazione | null>
  delete(id: string): Promise<boolean>
}

/** CRUD dei messaggi, elencabili e ordinati per conversazione. */
export interface MessaggioRepository {
  create(input: NuovoMessaggio): Promise<Messaggio>
  get(id: string): Promise<Messaggio | null>
  listByConversazione(conversazioneId: string): Promise<Messaggio[]>
  update(id: string, patch: PatchMessaggio): Promise<Messaggio | null>
  delete(id: string): Promise<boolean>
}

/** CRUD delle chiavi API. */
export interface ChiaveApiRepository {
  create(input: NuovaChiaveApi): Promise<ChiaveApi>
  get(id: string): Promise<ChiaveApi | null>
  list(): Promise<ChiaveApi[]>
  update(id: string, patch: PatchChiaveApi): Promise<ChiaveApi | null>
  delete(id: string): Promise<boolean>
}

// === Helper condivisi ========================================================

/** Generatore di identificativi, iniettabile per la testabilita. */
export type GenerateId = () => string

/** Traduce gli errori di vincolo del motore in `DataError` con codice stabile. */
function translateWriteError(cause: unknown): never {
  const code = (cause as { code?: unknown } | null)?.code
  if (typeof code === 'string') {
    if (code === '23505') {
      throw new DataError('Violazione di un vincolo di unicita.', 'UNIQUE_VIOLATION', { cause })
    }
    if (code === '23503') {
      throw new DataError('Violazione di una chiave esterna.', 'FOREIGN_KEY_VIOLATION', { cause })
    }
    if (code === '23514') {
      throw new DataError('Violazione di un vincolo di controllo.', 'INVALID_INPUT', { cause })
    }
  }
  throw cause
}

/**
 * Valida l'input di un'operazione con uno schema Zod, traducendo il fallimento
 * in `DataError` `INVALID_INPUT`. Cosi ai confini dello strato dati l'input non
 * valido e la violazione di vincolo condividono lo stesso tipo d'errore con
 * `code` stabile, senza far trapelare il `ZodError` del validatore.
 */
function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const esito = schema.safeParse(input)
  if (esito.success) return esito.data
  const dettaglio = esito.error.issues
    .map((i) => `${i.path.join('.') || '(radice)'}: ${i.message}`)
    .join('; ')
  throw new DataError(`Input non valido: ${dettaglio}.`, 'INVALID_INPUT', { cause: esito.error })
}

function malformed(column: string, value: unknown): never {
  throw new DataError(`Colonna «${column}» con valore inatteso (${typeof value}).`, 'MALFORMED_ROW')
}

function reqString(value: unknown, column: string): string {
  if (typeof value === 'string') return value
  return malformed(column, value)
}

function reqNumber(value: unknown, column: string): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return malformed(column, value)
}

function optString(value: unknown, column: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  return malformed(column, value)
}

/** Normalizza un timestamp del motore (Date o stringa) in ISO 8601. */
function reqIso(value: unknown, column: string): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return malformed(column, value)
}

function parseJson(value: unknown, column: string): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return malformed(column, value)
    }
  }
  return value
}

function jsonArray(value: unknown, column: string): unknown[] {
  const parsed = parseJson(value, column)
  if (Array.isArray(parsed)) return parsed
  return malformed(column, value)
}

function stringArray(value: unknown, column: string): string[] {
  return jsonArray(value, column).map((item) => {
    if (typeof item === 'string') return item
    return malformed(column, item)
  })
}

function jsonRecord(value: unknown, column: string): Record<string, unknown> {
  const parsed = parseJson(value, column)
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>
  }
  return malformed(column, value)
}

/**
 * Costruisce la clausola `SET` di un UPDATE dai soli campi definiti, con
 * parametri posizionali a partire da `$startIndex`. Restituisce `null` se non
 * c'e nulla da aggiornare.
 */
function buildSet(
  campi: ReadonlyArray<readonly [colonna: string, valore: unknown, cast?: string]>,
  startIndex: number
): { clausola: string; params: unknown[] } | null {
  const frammenti: string[] = []
  const params: unknown[] = []
  let i = startIndex
  for (const [colonna, valore, cast] of campi) {
    if (valore === undefined) continue
    frammenti.push(`${colonna} = $${i}${cast ?? ''}`)
    params.push(valore)
    i += 1
  }
  if (frammenti.length === 0) return null
  return { clausola: frammenti.join(', '), params }
}

type Row = Record<string, unknown>

// === Mappatori riga -> entita ================================================

function mapProgetto(row: Row): Progetto {
  return progettoSchema.parse({
    id: reqString(row.id, 'id'),
    nome: reqString(row.nome, 'nome'),
    creato_il: reqIso(row.creato_il, 'creato_il'),
    aggiornato_il: reqIso(row.aggiornato_il, 'aggiornato_il')
  })
}

function mapDocumento(row: Row): Documento {
  return documentoSchema.parse({
    id: reqString(row.id, 'id'),
    progetto_id: reqString(row.progetto_id, 'progetto_id'),
    nome: reqString(row.nome, 'nome'),
    formato: reqString(row.formato, 'formato'),
    uri_storage: optString(row.uri_storage, 'uri_storage'),
    versioni: jsonArray(row.versioni, 'versioni'),
    caricato_il: reqIso(row.caricato_il, 'caricato_il')
  })
}

function mapConversazione(row: Row): Conversazione {
  return conversazioneSchema.parse({
    id: reqString(row.id, 'id'),
    progetto_id: optString(row.progetto_id, 'progetto_id'),
    titolo: optString(row.titolo, 'titolo'),
    creata_il: reqIso(row.creata_il, 'creata_il'),
    aggiornata_il: reqIso(row.aggiornata_il, 'aggiornata_il')
  })
}

function mapMessaggio(row: Row): Messaggio {
  return messaggioSchema.parse({
    id: reqString(row.id, 'id'),
    conversazione_id: reqString(row.conversazione_id, 'conversazione_id'),
    ordine: reqNumber(row.ordine, 'ordine'),
    ruolo: reqString(row.ruolo, 'ruolo'),
    contenuto: reqString(row.contenuto, 'contenuto'),
    query_generate: stringArray(row.query_generate, 'query_generate'),
    citazioni: jsonArray(row.citazioni, 'citazioni'),
    chunk_usati: jsonArray(row.chunk_usati, 'chunk_usati'),
    creato_il: reqIso(row.creato_il, 'creato_il')
  })
}

function mapChiaveApi(row: Row): ChiaveApi {
  return chiaveApiSchema.parse({
    id: reqString(row.id, 'id'),
    provider: reqString(row.provider, 'provider'),
    valore_cifrato: reqString(row.valore_cifrato, 'valore_cifrato'),
    configurazione: jsonRecord(row.configurazione, 'configurazione'),
    creata_il: reqIso(row.creata_il, 'creata_il'),
    aggiornata_il: reqIso(row.aggiornata_il, 'aggiornata_il')
  })
}

// === Implementazioni =========================================================

class ProgettoRepositoryImpl implements ProgettoRepository {
  private readonly driver: SqlDriver
  private readonly generateId: GenerateId

  constructor(driver: SqlDriver, generateId: GenerateId) {
    this.driver = driver
    this.generateId = generateId
  }

  async create(input: NuovoProgetto): Promise<Progetto> {
    const { nome } = parseInput(nuovoProgettoSchema, input)
    const id = this.generateId()
    try {
      const { rows } = await this.driver.query<Row>(
        `INSERT INTO progetto (id, nome) VALUES ($1, $2) RETURNING *`,
        [id, nome]
      )
      return mapProgetto(rows[0])
    } catch (cause) {
      translateWriteError(cause)
    }
  }

  async get(id: string): Promise<Progetto | null> {
    const { rows } = await this.driver.query<Row>(`SELECT * FROM progetto WHERE id = $1`, [id])
    return rows[0] ? mapProgetto(rows[0]) : null
  }

  async list(): Promise<Progetto[]> {
    const { rows } = await this.driver.query<Row>(
      `SELECT * FROM progetto ORDER BY creato_il ASC, id ASC`
    )
    return rows.map(mapProgetto)
  }

  async update(id: string, patch: PatchProgetto): Promise<Progetto | null> {
    const { nome } = parseInput(patchProgettoSchema, patch)
    const set = buildSet([['nome', nome]], 2)
    if (!set) return this.get(id)
    try {
      const { rows } = await this.driver.query<Row>(
        `UPDATE progetto SET ${set.clausola}, aggiornato_il = now() WHERE id = $1 RETURNING *`,
        [id, ...set.params]
      )
      return rows[0] ? mapProgetto(rows[0]) : null
    } catch (cause) {
      translateWriteError(cause)
    }
  }

  async delete(id: string): Promise<boolean> {
    return deleteById(this.driver, 'progetto', id)
  }
}

class DocumentoRepositoryImpl implements DocumentoRepository {
  private readonly driver: SqlDriver
  private readonly generateId: GenerateId

  constructor(driver: SqlDriver, generateId: GenerateId) {
    this.driver = driver
    this.generateId = generateId
  }

  async create(input: NuovoDocumento): Promise<Documento> {
    const dati = parseInput(nuovoDocumentoSchema, input)
    const id = this.generateId()
    try {
      const { rows } = await this.driver.query<Row>(
        `INSERT INTO documento (id, progetto_id, nome, formato, uri_storage, versioni)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
        [
          id,
          dati.progetto_id,
          dati.nome,
          dati.formato,
          dati.uri_storage ?? null,
          JSON.stringify(dati.versioni ?? [])
        ]
      )
      return mapDocumento(rows[0])
    } catch (cause) {
      translateWriteError(cause)
    }
  }

  async get(id: string): Promise<Documento | null> {
    const { rows } = await this.driver.query<Row>(`SELECT * FROM documento WHERE id = $1`, [id])
    return rows[0] ? mapDocumento(rows[0]) : null
  }

  async listByProgetto(progettoId: string): Promise<Documento[]> {
    const { rows } = await this.driver.query<Row>(
      `SELECT * FROM documento WHERE progetto_id = $1 ORDER BY caricato_il ASC, id ASC`,
      [progettoId]
    )
    return rows.map(mapDocumento)
  }

  async update(id: string, patch: PatchDocumento): Promise<Documento | null> {
    const dati = parseInput(patchDocumentoSchema, patch)
    const set = buildSet(
      [
        ['nome', dati.nome],
        ['formato', dati.formato],
        ['uri_storage', dati.uri_storage],
        [
          'versioni',
          dati.versioni === undefined ? undefined : JSON.stringify(dati.versioni),
          '::jsonb'
        ]
      ],
      2
    )
    if (!set) return this.get(id)
    try {
      const { rows } = await this.driver.query<Row>(
        `UPDATE documento SET ${set.clausola} WHERE id = $1 RETURNING *`,
        [id, ...set.params]
      )
      return rows[0] ? mapDocumento(rows[0]) : null
    } catch (cause) {
      translateWriteError(cause)
    }
  }

  async delete(id: string): Promise<boolean> {
    return deleteById(this.driver, 'documento', id)
  }
}

class ConversazioneRepositoryImpl implements ConversazioneRepository {
  private readonly driver: SqlDriver
  private readonly generateId: GenerateId

  constructor(driver: SqlDriver, generateId: GenerateId) {
    this.driver = driver
    this.generateId = generateId
  }

  async create(input: NuovaConversazione): Promise<Conversazione> {
    const dati = parseInput(nuovaConversazioneSchema, input)
    const id = this.generateId()
    try {
      const { rows } = await this.driver.query<Row>(
        `INSERT INTO conversazione (id, progetto_id, titolo) VALUES ($1, $2, $3) RETURNING *`,
        [id, dati.progetto_id ?? null, dati.titolo ?? null]
      )
      return mapConversazione(rows[0])
    } catch (cause) {
      translateWriteError(cause)
    }
  }

  async get(id: string): Promise<Conversazione | null> {
    const { rows } = await this.driver.query<Row>(`SELECT * FROM conversazione WHERE id = $1`, [id])
    return rows[0] ? mapConversazione(rows[0]) : null
  }

  async list(): Promise<Conversazione[]> {
    const { rows } = await this.driver.query<Row>(
      `SELECT * FROM conversazione ORDER BY creata_il ASC, id ASC`
    )
    return rows.map(mapConversazione)
  }

  async listByProgetto(progettoId: string): Promise<Conversazione[]> {
    const { rows } = await this.driver.query<Row>(
      `SELECT * FROM conversazione WHERE progetto_id = $1 ORDER BY creata_il ASC, id ASC`,
      [progettoId]
    )
    return rows.map(mapConversazione)
  }

  async update(id: string, patch: PatchConversazione): Promise<Conversazione | null> {
    const dati = parseInput(patchConversazioneSchema, patch)
    const set = buildSet(
      [
        ['progetto_id', dati.progetto_id],
        ['titolo', dati.titolo]
      ],
      2
    )
    if (!set) return this.get(id)
    try {
      const { rows } = await this.driver.query<Row>(
        `UPDATE conversazione SET ${set.clausola}, aggiornata_il = now() WHERE id = $1 RETURNING *`,
        [id, ...set.params]
      )
      return rows[0] ? mapConversazione(rows[0]) : null
    } catch (cause) {
      translateWriteError(cause)
    }
  }

  async delete(id: string): Promise<boolean> {
    return deleteById(this.driver, 'conversazione', id)
  }
}

class MessaggioRepositoryImpl implements MessaggioRepository {
  private readonly driver: SqlDriver
  private readonly generateId: GenerateId

  constructor(driver: SqlDriver, generateId: GenerateId) {
    this.driver = driver
    this.generateId = generateId
  }

  async create(input: NuovoMessaggio): Promise<Messaggio> {
    const dati = parseInput(nuovoMessaggioSchema, input)
    const id = this.generateId()
    try {
      // La posizione va calcolata e inserita atomicamente: senza transazione,
      // due create concorrenti potrebbero leggere lo stesso «ordine» massimo.
      return await this.driver.transaction(async (tx) => {
        const ordine = dati.ordine ?? (await prossimoOrdine(tx, dati.conversazione_id))
        const { rows } = await tx.query<Row>(
          `INSERT INTO messaggio
             (id, conversazione_id, ordine, ruolo, contenuto, query_generate, citazioni, chunk_usati)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb) RETURNING *`,
          [
            id,
            dati.conversazione_id,
            ordine,
            dati.ruolo,
            dati.contenuto,
            JSON.stringify(dati.query_generate ?? []),
            JSON.stringify(dati.citazioni ?? []),
            JSON.stringify(dati.chunk_usati ?? [])
          ]
        )
        return mapMessaggio(rows[0])
      })
    } catch (cause) {
      translateWriteError(cause)
    }
  }

  async get(id: string): Promise<Messaggio | null> {
    const { rows } = await this.driver.query<Row>(`SELECT * FROM messaggio WHERE id = $1`, [id])
    return rows[0] ? mapMessaggio(rows[0]) : null
  }

  async listByConversazione(conversazioneId: string): Promise<Messaggio[]> {
    const { rows } = await this.driver.query<Row>(
      `SELECT * FROM messaggio WHERE conversazione_id = $1 ORDER BY ordine ASC`,
      [conversazioneId]
    )
    return rows.map(mapMessaggio)
  }

  async update(id: string, patch: PatchMessaggio): Promise<Messaggio | null> {
    const dati = parseInput(patchMessaggioSchema, patch)
    const set = buildSet(
      [
        ['contenuto', dati.contenuto],
        [
          'query_generate',
          dati.query_generate === undefined ? undefined : JSON.stringify(dati.query_generate),
          '::jsonb'
        ],
        [
          'citazioni',
          dati.citazioni === undefined ? undefined : JSON.stringify(dati.citazioni),
          '::jsonb'
        ],
        [
          'chunk_usati',
          dati.chunk_usati === undefined ? undefined : JSON.stringify(dati.chunk_usati),
          '::jsonb'
        ]
      ],
      2
    )
    if (!set) return this.get(id)
    try {
      const { rows } = await this.driver.query<Row>(
        `UPDATE messaggio SET ${set.clausola} WHERE id = $1 RETURNING *`,
        [id, ...set.params]
      )
      return rows[0] ? mapMessaggio(rows[0]) : null
    } catch (cause) {
      translateWriteError(cause)
    }
  }

  async delete(id: string): Promise<boolean> {
    return deleteById(this.driver, 'messaggio', id)
  }
}

class ChiaveApiRepositoryImpl implements ChiaveApiRepository {
  private readonly driver: SqlDriver
  private readonly generateId: GenerateId

  constructor(driver: SqlDriver, generateId: GenerateId) {
    this.driver = driver
    this.generateId = generateId
  }

  async create(input: NuovaChiaveApi): Promise<ChiaveApi> {
    const dati = parseInput(nuovaChiaveApiSchema, input)
    const id = this.generateId()
    try {
      const { rows } = await this.driver.query<Row>(
        `INSERT INTO chiave_api (id, provider, valore_cifrato, configurazione)
         VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
        [id, dati.provider, dati.valore_cifrato, JSON.stringify(dati.configurazione ?? {})]
      )
      return mapChiaveApi(rows[0])
    } catch (cause) {
      translateWriteError(cause)
    }
  }

  async get(id: string): Promise<ChiaveApi | null> {
    const { rows } = await this.driver.query<Row>(`SELECT * FROM chiave_api WHERE id = $1`, [id])
    return rows[0] ? mapChiaveApi(rows[0]) : null
  }

  async list(): Promise<ChiaveApi[]> {
    const { rows } = await this.driver.query<Row>(
      `SELECT * FROM chiave_api ORDER BY creata_il ASC, id ASC`
    )
    return rows.map(mapChiaveApi)
  }

  async update(id: string, patch: PatchChiaveApi): Promise<ChiaveApi | null> {
    const dati = parseInput(patchChiaveApiSchema, patch)
    const set = buildSet(
      [
        ['provider', dati.provider],
        ['valore_cifrato', dati.valore_cifrato],
        [
          'configurazione',
          dati.configurazione === undefined ? undefined : JSON.stringify(dati.configurazione),
          '::jsonb'
        ]
      ],
      2
    )
    if (!set) return this.get(id)
    try {
      const { rows } = await this.driver.query<Row>(
        `UPDATE chiave_api SET ${set.clausola}, aggiornata_il = now() WHERE id = $1 RETURNING *`,
        [id, ...set.params]
      )
      return rows[0] ? mapChiaveApi(rows[0]) : null
    } catch (cause) {
      translateWriteError(cause)
    }
  }

  async delete(id: string): Promise<boolean> {
    return deleteById(this.driver, 'chiave_api', id)
  }
}

/** Calcola la prossima posizione libera nella conversazione. */
async function prossimoOrdine(tx: SqlExecutor, conversazioneId: string): Promise<number> {
  const { rows } = await tx.query<{ prossimo: number }>(
    `SELECT COALESCE(MAX(ordine) + 1, 0) AS prossimo FROM messaggio WHERE conversazione_id = $1`,
    [conversazioneId]
  )
  return reqNumber(rows[0]?.prossimo, 'prossimo')
}

/** Cancella una riga per id; restituisce se qualcosa e stato cancellato. */
async function deleteById(driver: SqlDriver, tabella: string, id: string): Promise<boolean> {
  const { rows } = await driver.query<{ id: string }>(
    `DELETE FROM ${tabella} WHERE id = $1 RETURNING id`,
    [id]
  )
  return rows.length > 0
}

// === Factory =================================================================

export interface Repositories {
  progetti: ProgettoRepository
  documenti: DocumentoRepository
  conversazioni: ConversazioneRepository
  messaggi: MessaggioRepository
  chiaviApi: ChiaveApiRepository
}

/** Istanzia i repository su un motore e un generatore di id. */
export function createRepositories(driver: SqlDriver, generateId: GenerateId): Repositories {
  return {
    progetti: new ProgettoRepositoryImpl(driver, generateId),
    documenti: new DocumentoRepositoryImpl(driver, generateId),
    conversazioni: new ConversazioneRepositoryImpl(driver, generateId),
    messaggi: new MessaggioRepositoryImpl(driver, generateId),
    chiaviApi: new ChiaveApiRepositoryImpl(driver, generateId)
  }
}
