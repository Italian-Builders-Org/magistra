import { z } from 'zod'

// Manifest dell'indice del corpus.
//
// L'indice fisico (una tabella LanceDB su disco) non porta con sé la
// descrizione di come è stato costruito: quale modello di embedding lo ha
// popolato, con quante dimensioni, con quale schema di metadati. Questa
// informazione vive in un file `manifest.json` accanto alla tabella ed è
// l'unica fonte di verità sulla compatibilità tra una query e l'indice: un
// vettore prodotto da un embedder diverso non è confrontabile con i vettori
// indicizzati, quindi la query va rifiutata prima di sprecare una ricerca su
// uno spazio incoerente.

/** Versione corrente dello schema del manifest. */
export const CURRENT_INDEX_MANIFEST_SCHEMA = 1

/** Nome convenzionale del file di manifest dentro la cartella dell'indice. */
export const INDEX_MANIFEST_FILE_NAME = 'manifest.json'

/**
 * Identità del modello di embedding: la terna che rende un vettore
 * confrontabile con l'indice. Nome, dimensioni e versione devono coincidere
 * perché query e indice siano compatibili.
 */
export const embedderIdentitySchema = z.object({
  nome: z.string().min(1),
  dimensioni: z.number().int().positive(),
  versione: z.string().min(1)
})
export type EmbedderIdentity = z.infer<typeof embedderIdentitySchema>

/**
 * Strategia dell'indice ANN. Alla scala MVP è `flat` (esatto, recall 100%);
 * le altre varianti sono documentate per la crescita del corpus (vedi
 * `knowledge/architettura/indice-normativo.md`).
 */
export const indexStrategySchema = z.enum(['flat', 'ivf_hnsw', 'ivf_hnsw_rabitq'])
export type IndexStrategy = z.infer<typeof indexStrategySchema>

/** Metrica di distanza con cui l'indice è stato costruito. */
export const distanceMetricSchema = z.enum(['cosine', 'l2', 'dot'])
export type DistanceMetric = z.infer<typeof distanceMetricSchema>

/** Tipo scalare di un campo di metadato del chunk. */
export const chunkMetadataTypeSchema = z.enum(['string', 'int', 'float', 'bool', 'date'])
export type ChunkMetadataType = z.infer<typeof chunkMetadataTypeSchema>

/**
 * Descrizione di un campo di metadato co-locato col vettore nell'indice.
 * `filtrabile` indica che il campo è un scalar field su cui LanceDB può
 * applicare il prefiltro nativo (es. `vigenza_da`, `tipo_atto`).
 */
export const chunkMetadataFieldSchema = z.object({
  nome: z.string().min(1),
  tipo: chunkMetadataTypeSchema,
  nullable: z.boolean().default(false),
  filtrabile: z.boolean().default(false)
})
export type ChunkMetadataField = z.infer<typeof chunkMetadataFieldSchema>

/** Manifest completo dell'indice. */
export const indexManifestSchema = z.object({
  versione_schema: z.literal(CURRENT_INDEX_MANIFEST_SCHEMA),
  embedder: embedderIdentitySchema,
  metrica: distanceMetricSchema,
  strategia: indexStrategySchema,
  /** Nome della tabella LanceDB che contiene i vettori e i metadati. */
  tabella: z.string().min(1),
  /** Colonna che ospita il vettore dell'embedding. */
  colonna_vettore: z.string().min(1).default('vector'),
  /** Schema dei metadati del chunk, versionato in modo indipendente. */
  schema_metadati: z.object({
    versione: z.number().int().positive(),
    campi: z.array(chunkMetadataFieldSchema)
  }),
  /** Numero di chunk indicizzati, se noto (solo informativo). */
  conteggio_chunk: z.number().int().nonnegative().optional(),
  /** Data ISO 8601 di costruzione dell'indice, se nota (solo informativa). */
  creato_il: z.string().optional()
})
export type IndexManifest = z.infer<typeof indexManifestSchema>

/**
 * Valida e normalizza un manifest grezzo (es. il contenuto di `manifest.json`).
 * Applica i default (`colonna_vettore`, `nullable`, `filtrabile`) e lancia
 * `ZodError` se la forma non è valida.
 */
export function parseIndexManifest(raw: unknown): IndexManifest {
  return indexManifestSchema.parse(raw)
}

/**
 * Due embedder sono compatibili quando coincidono nome, dimensioni e versione.
 * La dimensione da sola non basta: modelli diversi possono avere la stessa
 * cardinalità ma spazi vettoriali incoerenti.
 */
export function isEmbedderCompatible(
  manifest: Pick<IndexManifest, 'embedder'>,
  expected: EmbedderIdentity
): boolean {
  const found = manifest.embedder
  return (
    found.nome === expected.nome &&
    found.dimensioni === expected.dimensioni &&
    found.versione === expected.versione
  )
}
