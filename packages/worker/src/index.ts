import type { AppInfo } from '@magistra/shared'

// Worker di ingest.
//
// È un processo Node separato dal backend: qui gireranno i job batch pesanti
// (parsing Akoma Ntoso, embedding massivo, indicizzazione), fuori dal thread
// che serve la chat, così l'assistente resta reattivo. La logica reale arriva
// nei task dedicati all'ingest; per ora è solo il punto d'ingresso del
// processo, con il confine tipizzato verso i contratti condivisi.

/** Punto d'ingresso del worker. */
export function main(info: AppInfo): void {
  console.log(`[worker] avvio ingest per ${info.name} v${info.version}`)
}

// Se eseguito direttamente come processo standalone.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main({ name: 'magistra', version: '0.0.1' })
}
