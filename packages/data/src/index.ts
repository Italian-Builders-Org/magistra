// Pacchetto dello strato dati applicativo.
//
// Espone l'interfaccia tipizzata dello store (CRUD delle entita applicative
// dietro repository), il confine del motore SQL, le migrazioni versionate e
// l'adattatore PGlite. La logica di dominio importa da qui e resta indipendente
// dal motore concreto: riceve un `DataStore` e non conosce ne PGlite ne lo
// schema SQL.

export { DataError, type DataErrorCode } from './errors.ts'

export type { SqlDriver, SqlExecutor, SqlResult } from './driver.ts'

export {
  MIGRAZIONI,
  TABELLA_MIGRAZIONI,
  eseguiMigrazioni,
  selezionaMigrazioniDaApplicare,
  type Migration
} from './migrations.ts'

export { SCHEMA_INIZIALE_SQL } from './schema.ts'

export { createDataStore, type DataStore, type CreateDataStoreOptions } from './store.ts'

export {
  createRepositories,
  type Repositories,
  type GenerateId,
  type ProgettoRepository,
  type DocumentoRepository,
  type ConversazioneRepository,
  type MessaggioRepository,
  type ChiaveApiRepository
} from './repositories.ts'

export { createPgliteDriver, openDataStore, type OpenDataStoreOptions } from './pglite.ts'

export {
  ruoloMessaggioSchema,
  progettoSchema,
  nuovoProgettoSchema,
  patchProgettoSchema,
  documentoSchema,
  nuovoDocumentoSchema,
  patchDocumentoSchema,
  conversazioneSchema,
  nuovaConversazioneSchema,
  patchConversazioneSchema,
  messaggioSchema,
  nuovoMessaggioSchema,
  patchMessaggioSchema,
  chiaveApiSchema,
  nuovaChiaveApiSchema,
  patchChiaveApiSchema,
  type RuoloMessaggio,
  type Progetto,
  type NuovoProgetto,
  type PatchProgetto,
  type Documento,
  type NuovoDocumento,
  type PatchDocumento,
  type Conversazione,
  type NuovaConversazione,
  type PatchConversazione,
  type Messaggio,
  type NuovoMessaggio,
  type PatchMessaggio,
  type ChiaveApi,
  type NuovaChiaveApi,
  type PatchChiaveApi
} from './types.ts'
