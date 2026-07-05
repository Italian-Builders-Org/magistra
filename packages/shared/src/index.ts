import { z } from 'zod'

// Pacchetto dei contratti condivisi.
//
// Qui vivono i tipi e gli schemi Zod usati ai confini tra i contesti (messaggi
// IPC, input dell'utente, dati esterni), così frontend, backend e worker
// parlano la stessa lingua senza duplicare le definizioni. Il contratto vero e
// proprio dell'orchestrazione (chat, retrieval, ricerca, upload) arriva nel
// task del core; per ora esponiamo solo le informazioni di base dell'app come
// esempio del pattern «tipo + schema di validazione».

/** Schema Zod delle informazioni di base sull'applicazione. */
export const appInfoSchema = z.object({
  name: z.string(),
  version: z.string()
})

/** Informazioni di base sull'applicazione, validate ai confini. */
export type AppInfo = z.infer<typeof appInfoSchema>
