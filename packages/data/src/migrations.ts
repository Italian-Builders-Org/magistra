import type { SqlDriver } from './driver.ts'
import { DataError } from './errors.ts'
import { SCHEMA_INIZIALE_SQL } from './schema.ts'

// Migrazioni versionate dello schema applicativo.
//
// Ogni migrazione ha un numero di versione progressivo (contiguo da 1) e uno
// script DDL. Lo strato dati tiene traccia delle versioni gia applicate in una
// tabella `_migrazioni` e applica in ordine solo quelle mancanti, dentro una
// transazione ciascuna: la migrazione da schema vuoto allo schema corrente e
// cosi riproducibile e ripetibile senza effetti (idempotente).

/** Una migrazione: una versione progressiva, un nome e lo script DDL da eseguire. */
export interface Migration {
  /** Numero di versione, intero positivo, contiguo a partire da 1. */
  version: number
  /** Nome leggibile della migrazione (a scopo diagnostico). */
  nome: string
  /** Script SQL (uno o piu statement) che porta lo schema alla versione. */
  up: string
}

/**
 * Elenco ordinato delle migrazioni. Aggiungere una migrazione significa
 * appendere una voce con la versione successiva, senza mai modificare o
 * rinumerare quelle gia rilasciate.
 */
export const MIGRAZIONI: readonly Migration[] = [
  { version: 1, nome: 'schema-iniziale', up: SCHEMA_INIZIALE_SQL }
]

/** Nome della tabella che registra le migrazioni applicate. */
export const TABELLA_MIGRAZIONI = '_migrazioni'

const CREA_TABELLA_MIGRAZIONI_SQL = `
CREATE TABLE IF NOT EXISTS ${TABELLA_MIGRAZIONI} (
  versione     INTEGER PRIMARY KEY,
  nome         TEXT NOT NULL,
  applicata_il TIMESTAMPTZ NOT NULL DEFAULT now()
);
`

/**
 * Verifica che l'elenco delle migrazioni sia coerente: versioni intere
 * positive, uniche e contigue a partire da 1.
 *
 * @throws {DataError} `MIGRATION_INCONSISTENT` se l'elenco non e ben formato.
 */
function validaElenco(tutte: readonly Migration[]): Migration[] {
  const ordinate = [...tutte].sort((a, b) => a.version - b.version)
  ordinate.forEach((m, i) => {
    const atteso = i + 1
    if (m.version !== atteso) {
      throw new DataError(
        `Elenco migrazioni non contiguo: attesa la versione ${atteso}, trovata ${m.version}.`,
        'MIGRATION_INCONSISTENT'
      )
    }
  })
  return ordinate
}

/**
 * Determina, date le versioni gia applicate e l'elenco completo, quali
 * migrazioni restano da applicare, in ordine di versione.
 *
 * E una funzione pura, cosi la logica di selezione e testabile senza un motore.
 *
 * @throws {DataError} `MIGRATION_INCONSISTENT` se lo stato applicato non e un
 *   prefisso coerente dell'elenco (versione sconosciuta o buco nella sequenza):
 *   lo schema su disco non e riproducibile da queste migrazioni.
 */
export function selezionaMigrazioniDaApplicare(
  applicate: readonly number[],
  tutte: readonly Migration[]
): Migration[] {
  const ordinate = validaElenco(tutte)
  const note = new Set(ordinate.map((m) => m.version))

  for (const v of applicate) {
    if (!note.has(v)) {
      throw new DataError(
        `Migrazione applicata sconosciuta: versione ${v}. ` +
          `Lo schema e stato costruito da un elenco di migrazioni diverso.`,
        'MIGRATION_INCONSISTENT'
      )
    }
  }

  const applicateSet = new Set(applicate)
  const pendenti = ordinate.filter((m) => !applicateSet.has(m.version))

  if (pendenti.length > 0 && applicate.length > 0) {
    const maxApplicata = Math.max(...applicate)
    if (pendenti[0].version < maxApplicata) {
      throw new DataError(
        `Sequenza di migrazioni incoerente: la versione ${pendenti[0].version} ` +
          `risulta non applicata benche la ${maxApplicata} lo sia.`,
        'MIGRATION_INCONSISTENT'
      )
    }
  }

  return pendenti
}

/**
 * Applica allo schema tutte le migrazioni mancanti, in ordine di versione.
 * Crea la tabella di tracciamento se assente, legge le versioni gia applicate e
 * applica ciascuna migrazione dentro una transazione, registrandola solo se il
 * DDL va a buon fine.
 *
 * @returns le versioni effettivamente applicate in questa esecuzione (vuoto se
 *   lo schema era gia aggiornato).
 * @throws {DataError} `MIGRATION_FAILED` se una migrazione fallisce;
 *   `MIGRATION_INCONSISTENT` se lo stato applicato non e coerente.
 */
export async function eseguiMigrazioni(
  driver: SqlDriver,
  migrazioni: readonly Migration[] = MIGRAZIONI
): Promise<number[]> {
  await driver.exec(CREA_TABELLA_MIGRAZIONI_SQL)

  const { rows } = await driver.query<{ versione: number }>(
    `SELECT versione FROM ${TABELLA_MIGRAZIONI} ORDER BY versione ASC`
  )
  const applicate = rows.map((r) => Number(r.versione))

  const daApplicare = selezionaMigrazioniDaApplicare(applicate, migrazioni)

  const eseguite: number[] = []
  for (const m of daApplicare) {
    try {
      await driver.transaction(async (tx) => {
        await tx.exec(m.up)
        await tx.query(`INSERT INTO ${TABELLA_MIGRAZIONI} (versione, nome) VALUES ($1, $2)`, [
          m.version,
          m.nome
        ])
      })
    } catch (cause) {
      if (cause instanceof DataError) throw cause
      throw new DataError(`Migrazione ${m.version} («${m.nome}») fallita.`, 'MIGRATION_FAILED', {
        cause
      })
    }
    eseguite.push(m.version)
  }

  return eseguite
}
