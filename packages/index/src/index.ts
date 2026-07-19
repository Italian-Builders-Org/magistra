// Pacchetto dell'indice del corpus normativo.
//
// Espone l'interfaccia tipizzata dell'indice (apertura, manifest, query ANN con
// prefiltro per metadato) e l'implementazione LanceDB di sola lettura. La logica
// di dominio importa da qui e resta indipendente dal motore concreto.

export {
  CURRENT_INDEX_MANIFEST_SCHEMA,
  INDEX_MANIFEST_FILE_NAME,
  embedderIdentitySchema,
  indexStrategySchema,
  distanceMetricSchema,
  chunkMetadataTypeSchema,
  chunkMetadataFieldSchema,
  indexManifestSchema,
  parseIndexManifest,
  isEmbedderCompatible,
  type EmbedderIdentity,
  type IndexStrategy,
  type DistanceMetric,
  type ChunkMetadataType,
  type ChunkMetadataField,
  type IndexManifest
} from './manifest.ts'

export { IndexError, IncompatibleEmbedderError, type IndexErrorCode } from './errors.ts'

export { buildPrefilter, type NormativeQueryFilter } from './prefilter.ts'

export {
  openNormativeIndex,
  DEFAULT_QUERY_LIMIT,
  type NormativeIndex,
  type NormativeQueryHit,
  type NormativeQueryOptions,
  type OpenNormativeIndexOptions,
  type IndexConnector,
  type IndexTable,
  type IndexSearchParams,
  type IndexSearchRow
} from './interface.ts'

export {
  createLanceConnector,
  loadManifestFromDisk,
  openLanceNormativeIndex,
  type OpenLanceNormativeIndexOptions
} from './lancedb.ts'
