import { randomUUID } from 'node:crypto'

import type { SqlDriver } from './driver.ts'
import { eseguiMigrazioni, MIGRAZIONI, type Migration } from './migrations.ts'
import {
  createRepositories,
  type ChiaveApiRepository,
  type ConversazioneRepository,
  type DocumentoRepository,
  type GenerateId,
  type MessaggioRepository,
  type ProgettoRepository
} from './repositories.ts'

// Store dei dati applicativi.
//
// E la facciata dello strato dati: raccoglie i repository delle entita ed
// espone la migrazione dello schema e la chiusura del motore. La logica di
// dominio riceve un `DataStore` e non conosce ne il motore concreto ne lo
// schema SQL; il motore (PGlite) arriva dietro l'interfaccia `SqlDriver`.

/** La facciata dello strato dati: i repository piu il ciclo di vita del motore. */
export interface DataStore {
  readonly progetti: ProgettoRepository
  readonly documenti: DocumentoRepository
  readonly conversazioni: ConversazioneRepository
  readonly messaggi: MessaggioRepository
  readonly chiaviApi: ChiaveApiRepository
  /**
   * Porta lo schema alla versione corrente applicando le migrazioni mancanti.
   * Idempotente: rieseguirla su uno schema aggiornato non fa nulla.
   *
   * @returns le versioni applicate in questa chiamata (vuoto se gia aggiornato).
   */
  migrate(): Promise<number[]>
  /** Rilascia le risorse del motore. */
  close(): Promise<void>
}

/** Opzioni per costruire uno store sopra un motore gia aperto. */
export interface CreateDataStoreOptions {
  /**
   * Generatore degli identificativi delle entita. Default: `crypto.randomUUID`.
   * Iniettabile per rendere deterministici i test.
   */
  generateId?: GenerateId
  /**
   * Elenco delle migrazioni da applicare. Default: le migrazioni del pacchetto.
   * Iniettabile per i test dello schema.
   */
  migrazioni?: readonly Migration[]
}

/**
 * Costruisce uno store sopra un `SqlDriver` gia aperto, senza toccare lo schema:
 * la migrazione resta esplicita (`store.migrate()`), cosi la costruzione e
 * sincrona e il momento in cui si scrive sullo schema e sotto controllo.
 */
export function createDataStore(
  driver: SqlDriver,
  options: CreateDataStoreOptions = {}
): DataStore {
  const generateId = options.generateId ?? randomUUID
  const migrazioni = options.migrazioni ?? MIGRAZIONI
  const repos = createRepositories(driver, generateId)

  return {
    progetti: repos.progetti,
    documenti: repos.documenti,
    conversazioni: repos.conversazioni,
    messaggi: repos.messaggi,
    chiaviApi: repos.chiaviApi,
    migrate: () => eseguiMigrazioni(driver, migrazioni),
    close: () => driver.close()
  }
}
