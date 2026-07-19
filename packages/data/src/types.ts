import { z } from 'zod'

// Tipi delle entita del modello dati applicativo.
//
// Gli schemi Zod sono la fonte di verita sia dei tipi TypeScript sia della
// validazione ai confini dello strato dati. Le entita e i loro campi seguono il
// modello applicativo della knowledge base (progetto, documento, conversazione,
// messaggio, chiave API), in italiano come il resto dello schema.
//
// I timestamp attraversano l'interfaccia come stringhe ISO 8601 (UTC), cosi il
// modello resta serializzabile attraverso l'IPC senza dipendere da come il
// motore rappresenta `timestamptz`.

/** Ruolo di un turno di conversazione. */
export const ruoloMessaggioSchema = z.enum(['utente', 'assistente', 'sistema'])
export type RuoloMessaggio = z.infer<typeof ruoloMessaggioSchema>

// === Progetto ================================================================

/** Spazio di lavoro che raggruppa documenti e conversazioni attorno a una pratica. */
export const progettoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  creato_il: z.string(),
  aggiornato_il: z.string()
})
export type Progetto = z.infer<typeof progettoSchema>

/** Dati per creare un progetto. */
export const nuovoProgettoSchema = z.object({
  nome: z.string().min(1)
})
export type NuovoProgetto = z.infer<typeof nuovoProgettoSchema>

/** Modifiche parziali a un progetto. */
export const patchProgettoSchema = z
  .object({
    nome: z.string().min(1)
  })
  .partial()
export type PatchProgetto = z.infer<typeof patchProgettoSchema>

// === Documento ===============================================================

/** File dell'utente caricato o redatto dentro un progetto. */
export const documentoSchema = z.object({
  id: z.string(),
  progetto_id: z.string(),
  nome: z.string(),
  formato: z.string(),
  uri_storage: z.string().nullable(),
  /** Cronologia denormalizzata delle modifiche tracciate, finche non serve una tabella dedicata. */
  versioni: z.array(z.unknown()),
  caricato_il: z.string()
})
export type Documento = z.infer<typeof documentoSchema>

/** Dati per creare un documento. */
export const nuovoDocumentoSchema = z.object({
  progetto_id: z.string().min(1),
  nome: z.string().min(1),
  formato: z.string().min(1),
  uri_storage: z.string().nullable().optional(),
  versioni: z.array(z.unknown()).optional()
})
export type NuovoDocumento = z.infer<typeof nuovoDocumentoSchema>

/** Modifiche parziali a un documento. */
export const patchDocumentoSchema = z
  .object({
    nome: z.string().min(1),
    formato: z.string().min(1),
    uri_storage: z.string().nullable(),
    versioni: z.array(z.unknown())
  })
  .partial()
export type PatchDocumento = z.infer<typeof patchDocumentoSchema>

// === Conversazione ===========================================================

/** Sessione di dialogo tra utente e assistente, opzionalmente dentro un progetto. */
export const conversazioneSchema = z.object({
  id: z.string(),
  progetto_id: z.string().nullable(),
  titolo: z.string().nullable(),
  creata_il: z.string(),
  aggiornata_il: z.string()
})
export type Conversazione = z.infer<typeof conversazioneSchema>

/** Dati per creare una conversazione. */
export const nuovaConversazioneSchema = z.object({
  progetto_id: z.string().nullable().optional(),
  titolo: z.string().nullable().optional()
})
export type NuovaConversazione = z.infer<typeof nuovaConversazioneSchema>

/** Modifiche parziali a una conversazione. */
export const patchConversazioneSchema = z
  .object({
    progetto_id: z.string().nullable(),
    titolo: z.string().nullable()
  })
  .partial()
export type PatchConversazione = z.infer<typeof patchConversazioneSchema>

// === Messaggio ===============================================================

/** Singolo turno di una conversazione con le sue citazioni e i chunk usati. */
export const messaggioSchema = z.object({
  id: z.string(),
  conversazione_id: z.string(),
  ordine: z.number().int(),
  ruolo: ruoloMessaggioSchema,
  contenuto: z.string(),
  /** Query di ricerca pianificate dall'assistente per questo turno (tracciabilita). */
  query_generate: z.array(z.string()),
  /** Citazioni verificabili prodotte; la forma interna e definita dal flusso RAG. */
  citazioni: z.array(z.unknown()),
  /** Chunk recuperati a sostegno della risposta. */
  chunk_usati: z.array(z.unknown()),
  creato_il: z.string()
})
export type Messaggio = z.infer<typeof messaggioSchema>

/**
 * Dati per creare un messaggio. `ordine` e opzionale: se omesso, lo strato dati
 * assegna la posizione successiva all'interno della conversazione.
 */
export const nuovoMessaggioSchema = z.object({
  conversazione_id: z.string().min(1),
  ordine: z.number().int().nonnegative().optional(),
  ruolo: ruoloMessaggioSchema,
  contenuto: z.string(),
  query_generate: z.array(z.string()).optional(),
  citazioni: z.array(z.unknown()).optional(),
  chunk_usati: z.array(z.unknown()).optional()
})
export type NuovoMessaggio = z.infer<typeof nuovoMessaggioSchema>

/** Modifiche parziali a un messaggio. */
export const patchMessaggioSchema = z
  .object({
    contenuto: z.string(),
    query_generate: z.array(z.string()),
    citazioni: z.array(z.unknown()),
    chunk_usati: z.array(z.unknown())
  })
  .partial()
export type PatchMessaggio = z.infer<typeof patchMessaggioSchema>

// === Chiave API ==============================================================

/**
 * Credenziale di un provider LLM configurata in locale. Lo strato dati conserva
 * soltanto il valore gia cifrato (AES-256-GCM), prodotto dal componente di
 * cifratura a monte: qui non si cifra ne si decifra, e il valore in chiaro non
 * attraversa mai questa interfaccia.
 */
export const chiaveApiSchema = z.object({
  id: z.string(),
  provider: z.string(),
  valore_cifrato: z.string(),
  /** Metadati non segreti: base URL, modello predefinito, profilo. */
  configurazione: z.record(z.unknown()),
  creata_il: z.string(),
  aggiornata_il: z.string()
})
export type ChiaveApi = z.infer<typeof chiaveApiSchema>

/** Dati per creare una chiave API. */
export const nuovaChiaveApiSchema = z.object({
  provider: z.string().min(1),
  valore_cifrato: z.string().min(1),
  configurazione: z.record(z.unknown()).optional()
})
export type NuovaChiaveApi = z.infer<typeof nuovaChiaveApiSchema>

/** Modifiche parziali a una chiave API. */
export const patchChiaveApiSchema = z
  .object({
    provider: z.string().min(1),
    valore_cifrato: z.string().min(1),
    configurazione: z.record(z.unknown())
  })
  .partial()
export type PatchChiaveApi = z.infer<typeof patchChiaveApiSchema>
