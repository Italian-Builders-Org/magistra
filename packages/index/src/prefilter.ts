import { IndexError } from './errors.ts'

// Costruzione del prefiltro per metadato.
//
// LanceDB applica il filtro *prima* della ricerca ANN (prefiltro nativo): il
// `WHERE` restringe l'insieme dei candidati dentro il motore, il punto su cui
// un postfiltro (WHERE dopo il top-k) crollerebbe sotto filtro. Qui traduciamo
// un filtro tipizzato in una espressione SQL, con escaping dei letterali e
// validazione delle date, così i valori dei metadati non possono rompere la
// clausola né iniettare SQL.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Filtro tipizzato sui metadati del chunk. Ogni campo è opzionale; un filtro
 * vuoto non restringe nulla (nessuna clausola `where`).
 */
export interface NormativeQueryFilter {
  /**
   * Data ISO (`YYYY-MM-DD`) rispetto a cui l'atto deve essere vigente:
   * seleziona le righe con `vigenza_da <= data` e `vigenza_a` nullo (intervallo
   * aperto, versione ancora in vigore) oppure `>= data`.
   */
  vigenteAl?: string
  /** Uno o più tipi di atto ammessi (es. `legge`, `decreto-legge`). */
  tipoAtto?: string | readonly string[]
  /** Una o più fonti ammesse. */
  fonte?: string | readonly string[]
}

/** Restituisce il letterale SQL per una stringa, con gli apici raddoppiati. */
function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function toList(value: string | readonly string[]): string[] {
  return Array.isArray(value) ? [...value] : [value as string]
}

function inClause(column: string, value: string | readonly string[]): string | null {
  const list = toList(value)
  if (list.length === 0) {
    return null
  }
  if (list.length === 1) {
    return `${column} = ${quote(list[0]!)}`
  }
  return `${column} IN (${list.map(quote).join(', ')})`
}

/**
 * Traduce un filtro tipizzato nella clausola SQL del prefiltro LanceDB.
 * Restituisce `null` quando il filtro non impone alcun vincolo, così il
 * chiamante può omettere del tutto il `where`.
 *
 * @throws {IndexError} con codice `INVALID_FILTER` se una data non è ISO.
 */
export function buildPrefilter(filter: NormativeQueryFilter): string | null {
  const clauses: string[] = []

  if (filter.vigenteAl !== undefined) {
    if (!ISO_DATE.test(filter.vigenteAl)) {
      throw new IndexError(
        `Data di vigenza non valida: ${filter.vigenteAl} (atteso YYYY-MM-DD).`,
        'INVALID_FILTER'
      )
    }
    // `vigenza_da`/`vigenza_a` sono conservate come stringhe ISO `YYYY-MM-DD`:
    // il confronto `<=`/`>=` è lessicografico, che per questo formato coincide
    // con l'ordine cronologico. L'invariante regge finché l'ingest scrive date
    // in questo formato (validato in ingresso da `ISO_DATE`).
    const date = quote(filter.vigenteAl)
    clauses.push(`vigenza_da <= ${date}`)
    clauses.push(`(vigenza_a IS NULL OR vigenza_a >= ${date})`)
  }

  if (filter.tipoAtto !== undefined) {
    const clause = inClause('tipo_atto', filter.tipoAtto)
    if (clause) {
      clauses.push(clause)
    }
  }

  if (filter.fonte !== undefined) {
    const clause = inClause('fonte', filter.fonte)
    if (clause) {
      clauses.push(clause)
    }
  }

  if (clauses.length === 0) {
    return null
  }

  return clauses.join(' AND ')
}
