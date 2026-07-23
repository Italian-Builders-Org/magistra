import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { Button } from '@magistra/ui/components/button'
import { Input } from '@magistra/ui/components/input'
import type {
  ModalitaPrivacy,
  ProviderConfigInput,
  ProviderKind,
  ProviderTestResult,
  ProviderView,
  StatoConnessione
} from '@magistra/shared'

import {
  ETICHETTE_PROVIDER,
  KIND_PROVIDER,
  SUGGERIMENTI_EMBEDDING,
  SUGGERIMENTI_GENERAZIONE,
  chiaveObbligatoria,
  offreEmbedding,
  richiedeBaseUrl
} from './provider-metadata'

// Pagina di gestione delle API key (configurazione dei provider).
//
// L'utente porta la propria chiave: qui si configurano provider ed endpoint, si
// sceglie il modello attivo e si testa la connessione. La chiave si inserisce in
// un campo mascherato e non torna mai indietro dal main: la UI ne conosce solo
// la presenza (`haChiave`). Tutta la persistenza e la cifratura avvengono nel
// processo main via IPC.

/** Una riga dell'editor degli header di autenticazione. */
interface RigaHeader {
  nome: string
  valore: string
}

/** Bozza modificabile nel form, con i campi come stringhe di input. */
interface Bozza {
  id?: string
  kind: ProviderKind
  nome: string
  baseUrl: string
  generationModel: string
  embeddingModel: string
  timeoutMs: string
  privacy: ModalitaPrivacy
  apiKey: string
  /** Righe dell'editor header (i valori non tornano mai dal main: sempre vuote all'apertura). */
  headerRighe: RigaHeader[]
  /** L'utente sta (ri)definendo gli header: se falso, quelli salvati restano invariati. */
  sostituisciHeaders: boolean
  /** Quanti header risultano gia configurati (solo per l'etichetta in modifica). */
  numeroHeaderEsistente: number
}

const CLASSE_SELECT =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

function bozzaVuota(kind: ProviderKind = 'anthropic'): Bozza {
  return {
    kind,
    nome: '',
    baseUrl: '',
    generationModel: '',
    embeddingModel: '',
    timeoutMs: '',
    privacy: 'standard',
    apiKey: '',
    headerRighe: [],
    // Su un provider nuovo gli header si definiscono direttamente.
    sostituisciHeaders: true,
    numeroHeaderEsistente: 0
  }
}

/**
 * Primo tipo di provider ancora configurabile, su cui aprire il form nuovo.
 * L'endpoint OpenAI-compatibile e sempre disponibile (piu macchine, piu righe)
 * ed e quindi il ripiego naturale quando i remoti sono tutti presi.
 */
function primoKindLibero(configurati: ProviderView[]): ProviderKind {
  const presi = new Set(configurati.map((p) => p.kind))
  return (
    KIND_PROVIDER.find((kind) => kind === 'openai-compatible' || !presi.has(kind)) ?? 'anthropic'
  )
}

function bozzaDaProvider(p: ProviderView): Bozza {
  return {
    id: p.id,
    kind: p.kind,
    nome: p.nome ?? '',
    baseUrl: p.baseUrl ?? '',
    generationModel: p.generationModel ?? '',
    embeddingModel: p.embeddingModel ?? '',
    timeoutMs: p.timeoutMs ? String(p.timeoutMs) : '',
    privacy: p.privacy,
    apiKey: '',
    headerRighe: [],
    // In modifica gli header salvati restano invariati finche non li si sostituisce.
    sostituisciHeaders: false,
    numeroHeaderEsistente: p.numeroHeader
  }
}

/** Traduce la bozza nel DTO inviato al main, omettendo i campi vuoti. */
function bozzaAInput(bozza: Bozza): ProviderConfigInput {
  const input: ProviderConfigInput = { kind: bozza.kind }
  if (bozza.id) input.id = bozza.id
  const nome = bozza.nome.trim()
  if (nome) input.nome = nome
  const baseUrl = bozza.baseUrl.trim()
  if (baseUrl) input.baseUrl = baseUrl
  const generationModel = bozza.generationModel.trim()
  if (generationModel) input.generationModel = generationModel
  const embeddingModel = bozza.embeddingModel.trim()
  if (embeddingModel) input.embeddingModel = embeddingModel
  const timeout = bozza.timeoutMs.trim()
  if (timeout) input.timeoutMs = Number(timeout)
  input.privacy = bozza.privacy
  // La chiave si invia solo se digitata: vuota, resta invariata (in modifica) o
  // assente (endpoint locale senza auth).
  if (bozza.apiKey.length > 0) input.apiKey = bozza.apiKey
  // Gli header si inviano solo se l'utente li sta (ri)definendo. In modifica si
  // invia anche l'oggetto vuoto (per rimuoverli); su un provider nuovo si omette
  // se non ne e stato inserito nessuno.
  if (bozza.kind === 'openai-compatible' && bozza.sostituisciHeaders) {
    const headers = headerDaRighe(bozza.headerRighe)
    if (bozza.id) {
      input.headers = headers
    } else if (Object.keys(headers).length > 0) {
      input.headers = headers
    }
  }
  return input
}

/** Raccoglie le righe non vuote in un oggetto nome -> valore. */
function headerDaRighe(righe: RigaHeader[]): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const riga of righe) {
    const nome = riga.nome.trim()
    if (nome && riga.valore.length > 0) headers[nome] = riga.valore
  }
  return headers
}

const ETICHETTA_STATO: Record<StatoConnessione, string> = {
  ok: 'Raggiungibile',
  non_raggiungibile: 'Non raggiungibile',
  modello_mancante: 'Modello mancante'
}

const CLASSE_STATO: Record<StatoConnessione, string> = {
  ok: 'text-green-600 dark:text-green-400',
  non_raggiungibile: 'text-destructive',
  modello_mancante: 'text-amber-600 dark:text-amber-400'
}

export function SettingsPage() {
  const [providers, setProviders] = useState<ProviderView[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [bozza, setBozza] = useState<Bozza | null>(null)
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false)
  const [idOccupato, setIdOccupato] = useState<string | null>(null)
  const [idDaEliminare, setIdDaEliminare] = useState<string | null>(null)
  const [esitiTest, setEsitiTest] = useState<Record<string, ProviderTestResult | 'loading'>>({})

  // L'esito di un test vale per la configurazione con cui e stato ottenuto:
  // appena questa cambia (o il provider sparisce) va buttato, altrimenti si
  // continuerebbe a mostrare «Raggiungibile» accanto a dati ormai diversi.
  const scartaEsito = useCallback((id: string) => {
    setEsitiTest((precedente) => {
      if (!(id in precedente)) return precedente
      const resto = { ...precedente }
      delete resto[id]
      return resto
    })
  }, [])

  const aggiorna = useCallback(async () => {
    setCaricamento(true)
    setErrore(null)
    try {
      const { providers } = await window.magistra.providerList({})
      setProviders(providers)
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setCaricamento(false)
    }
  }, [])

  useEffect(() => {
    void aggiorna()
  }, [aggiorna])

  async function salva(): Promise<void> {
    if (!bozza) return
    setSalvataggioInCorso(true)
    setErrore(null)
    try {
      await window.magistra.providerSave(bozzaAInput(bozza))
      if (bozza.id) scartaEsito(bozza.id)
      setBozza(null)
      await aggiorna()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setSalvataggioInCorso(false)
    }
  }

  async function elimina(id: string): Promise<void> {
    setIdOccupato(id)
    setIdDaEliminare(null)
    setErrore(null)
    try {
      await window.magistra.providerDelete({ id })
      scartaEsito(id)
      if (bozza?.id === id) setBozza(null)
      await aggiorna()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setIdOccupato(null)
    }
  }

  async function attiva(id: string): Promise<void> {
    setIdOccupato(id)
    setErrore(null)
    try {
      await window.magistra.providerActivate({ id })
      await aggiorna()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setIdOccupato(null)
    }
  }

  async function testa(id: string): Promise<void> {
    setEsitiTest((precedente) => ({ ...precedente, [id]: 'loading' }))
    try {
      const esito = await window.magistra.providerTest({ id })
      setEsitiTest((precedente) => ({ ...precedente, [id]: esito }))
    } catch (e) {
      setEsitiTest((precedente) => ({
        ...precedente,
        [id]: { stato: 'non_raggiungibile', messaggio: messaggioErrore(e) }
      }))
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight text-balance">Impostazioni</h1>
        {!bozza && (
          <Button onClick={() => setBozza(bozzaVuota(primoKindLibero(providers)))}>
            Aggiungi provider
          </Button>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Configura i provider LLM con la tua chiave. I segreti sono cifrati sul dispositivo e non
        lasciano mai la macchina.
      </p>

      {errore && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errore}
        </div>
      )}

      {bozza && (
        <FormProvider
          bozza={bozza}
          kindGiaConfigurati={providers.map((p) => p.kind)}
          onChange={setBozza}
          onSalva={salva}
          onAnnulla={() => setBozza(null)}
          inCorso={salvataggioInCorso}
        />
      )}

      <div className="mt-8 flex flex-col gap-3">
        {caricamento ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun provider configurato.</p>
        ) : (
          providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              esito={esitiTest[p.id]}
              occupato={idOccupato === p.id}
              inConferma={idDaEliminare === p.id}
              onModifica={() => setBozza(bozzaDaProvider(p))}
              onChiediElimina={() => setIdDaEliminare(p.id)}
              onAnnullaElimina={() => setIdDaEliminare(null)}
              onElimina={() => elimina(p.id)}
              onAttiva={() => attiva(p.id)}
              onTesta={() => testa(p.id)}
            />
          ))
        )}
      </div>
    </section>
  )
}

// === Form di creazione/modifica =============================================

function FormProvider(props: {
  bozza: Bozza
  kindGiaConfigurati: ProviderKind[]
  onChange: (b: Bozza) => void
  onSalva: () => void
  onAnnulla: () => void
  inCorso: boolean
}) {
  const { bozza, kindGiaConfigurati, onChange, onSalva, onAnnulla, inCorso } = props
  const modifica = !!bozza.id
  const modelliGen = useMemo(() => SUGGERIMENTI_GENERAZIONE[bozza.kind], [bozza.kind])
  const modelliEmb = useMemo(() => SUGGERIMENTI_EMBEDDING[bozza.kind], [bozza.kind])

  function imposta<K extends keyof Bozza>(campo: K, valore: Bozza[K]): void {
    onChange({ ...bozza, [campo]: valore })
  }

  return (
    <form
      className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSalva()
      }}
    >
      <h2 className="text-lg font-semibold">{modifica ? 'Modifica provider' : 'Nuovo provider'}</h2>

      <Campo etichetta="Provider">
        <select
          className={CLASSE_SELECT}
          value={bozza.kind}
          disabled={modifica}
          onChange={(e) => imposta('kind', e.target.value as ProviderKind)}
        >
          {KIND_PROVIDER.map((kind) => {
            // Di un provider remoto se ne configura uno solo (il servizio lo
            // impone): mostrarlo comunque, ma non selezionabile, evita di far
            // compilare un form che verrebbe rifiutato al salvataggio.
            const giaPreso =
              !modifica && kind !== 'openai-compatible' && kindGiaConfigurati.includes(kind)
            return (
              <option key={kind} value={kind} disabled={giaPreso}>
                {ETICHETTE_PROVIDER[kind]}
                {giaPreso ? ' (gia configurato)' : ''}
              </option>
            )
          })}
        </select>
      </Campo>

      {richiedeBaseUrl(bozza.kind) && (
        <>
          <Campo etichetta="Nome (facoltativo)">
            <Input
              value={bozza.nome}
              placeholder="Ollama locale"
              onChange={(e) => imposta('nome', e.target.value)}
            />
          </Campo>
          <Campo etichetta="Base URL">
            <Input
              value={bozza.baseUrl}
              placeholder="http://localhost:11434/v1"
              onChange={(e) => imposta('baseUrl', e.target.value)}
            />
          </Campo>
        </>
      )}

      <Campo etichetta="Modello di generazione">
        <Input
          value={bozza.generationModel}
          list={`gen-${bozza.kind}`}
          placeholder={modelliGen[0]}
          onChange={(e) => imposta('generationModel', e.target.value)}
        />
        <datalist id={`gen-${bozza.kind}`}>
          {modelliGen.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Campo>

      {offreEmbedding(bozza.kind) && (
        <Campo etichetta="Modello di embedding (facoltativo)">
          <Input
            value={bozza.embeddingModel}
            list={`emb-${bozza.kind}`}
            placeholder={modelliEmb[0]}
            onChange={(e) => imposta('embeddingModel', e.target.value)}
          />
          <datalist id={`emb-${bozza.kind}`}>
            {modelliEmb.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Campo>
      )}

      <Campo
        etichetta={
          chiaveObbligatoria(bozza.kind)
            ? 'API key'
            : 'API key (facoltativa per un endpoint locale)'
        }
      >
        <Input
          type="password"
          autoComplete="off"
          value={bozza.apiKey}
          placeholder={modifica ? 'Lascia vuoto per non cambiarla' : 'sk-...'}
          onChange={(e) => imposta('apiKey', e.target.value)}
        />
      </Campo>

      {richiedeBaseUrl(bozza.kind) && <EditorHeader bozza={bozza} onChange={onChange} />}

      <div className="flex gap-4">
        <Campo etichetta="Timeout (ms, facoltativo)">
          <Input
            type="number"
            min={1}
            value={bozza.timeoutMs}
            placeholder="15000"
            onChange={(e) => imposta('timeoutMs', e.target.value)}
          />
        </Campo>
        <Campo etichetta="Modalita privacy">
          <select
            className={CLASSE_SELECT}
            value={bozza.privacy}
            onChange={(e) => imposta('privacy', e.target.value as ModalitaPrivacy)}
          >
            <option value="standard">Standard</option>
            <option value="rigorosa">Rigorosa</option>
          </select>
        </Campo>
      </div>

      <div className="mt-1 flex gap-2">
        <Button type="submit" disabled={inCorso}>
          {inCorso ? 'Salvataggio...' : 'Salva'}
        </Button>
        <Button type="button" variant="ghost" onClick={onAnnulla} disabled={inCorso}>
          Annulla
        </Button>
      </div>
    </form>
  )
}

// Editor degli header di autenticazione custom (endpoint OpenAI-compatibile).
//
// Gli header sono segreti come la chiave: i valori non tornano mai dal main,
// quindi l'editor parte sempre vuoto. In modifica gli header salvati restano
// invariati finche l'utente non sceglie di sostituirli.
function EditorHeader(props: { bozza: Bozza; onChange: (b: Bozza) => void }) {
  const { bozza, onChange } = props
  const modifica = !!bozza.id

  function impostaRighe(headerRighe: RigaHeader[]): void {
    onChange({ ...bozza, headerRighe })
  }

  if (!bozza.sostituisciHeaders) {
    return (
      <Campo etichetta="Header di autenticazione">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {bozza.numeroHeaderEsistente > 0
              ? `${bozza.numeroHeaderEsistente} header configurati`
              : 'Nessun header configurato'}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({
                ...bozza,
                sostituisciHeaders: true,
                headerRighe: [{ nome: '', valore: '' }]
              })
            }
          >
            Sostituisci header
          </Button>
        </div>
      </Campo>
    )
  }

  return (
    <Campo etichetta="Header di autenticazione">
      <div className="flex flex-col gap-2">
        {bozza.headerRighe.map((riga, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={riga.nome}
              placeholder="Authorization"
              autoComplete="off"
              onChange={(e) =>
                impostaRighe(
                  bozza.headerRighe.map((r, j) => (j === i ? { ...r, nome: e.target.value } : r))
                )
              }
            />
            <Input
              type="password"
              value={riga.valore}
              placeholder="Bearer ..."
              autoComplete="off"
              onChange={(e) =>
                impostaRighe(
                  bozza.headerRighe.map((r, j) => (j === i ? { ...r, valore: e.target.value } : r))
                )
              }
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Rimuovi header"
              onClick={() => impostaRighe(bozza.headerRighe.filter((_, j) => j !== i))}
            >
              ×
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => impostaRighe([...bozza.headerRighe, { nome: '', valore: '' }])}
          >
            Aggiungi header
          </Button>
        </div>
        {modifica && (
          <p className="text-xs text-muted-foreground">
            Al salvataggio questi header sostituiscono quelli esistenti (lista vuota: li rimuove).
          </p>
        )}
      </div>
    </Campo>
  )
}

function Campo(props: { etichetta: string; children: ReactNode }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-sm font-medium">{props.etichetta}</span>
      {props.children}
    </label>
  )
}

// === Scheda di un provider configurato ======================================

function ProviderCard(props: {
  provider: ProviderView
  esito: ProviderTestResult | 'loading' | undefined
  occupato: boolean
  inConferma: boolean
  onModifica: () => void
  onChiediElimina: () => void
  onAnnullaElimina: () => void
  onElimina: () => void
  onAttiva: () => void
  onTesta: () => void
}) {
  const { provider: p, esito, occupato, inConferma } = props
  const titolo = p.nome ?? ETICHETTE_PROVIDER[p.kind]

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{titolo}</span>
            {p.attivo && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Attivo
              </span>
            )}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {p.haChiave ? 'Chiave: •••• configurata' : 'Nessuna chiave'}
            </span>
            {p.numeroHeader > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {p.numeroHeader} header
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.generationModel ?? 'Nessun modello'}
            {p.baseUrl ? ` · ${p.baseUrl}` : ''}
          </p>
          {esito && esito !== 'loading' && (
            <p className={`mt-1 text-sm font-medium ${CLASSE_STATO[esito.stato]}`}>
              {ETICHETTA_STATO[esito.stato]}: {esito.messaggio}
            </p>
          )}
          {esito === 'loading' && (
            <p className="mt-1 text-sm text-muted-foreground">Test in corso...</p>
          )}
        </div>
      </div>

      {/* L'eliminazione e irreversibile: la chiave cifrata sparisce e va
          reinserita. Il secondo click e la conferma. */}
      {inConferma ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-destructive">
            Eliminare «{titolo}»? La chiave salvata andra reinserita.
          </span>
          <Button size="sm" variant="destructive" onClick={props.onElimina} disabled={occupato}>
            Elimina definitivamente
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onAnnullaElimina} disabled={occupato}>
            Annulla
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!p.attivo && (
            <Button size="sm" variant="outline" onClick={props.onAttiva} disabled={occupato}>
              Attiva
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={props.onTesta}
            disabled={esito === 'loading'}
          >
            Testa connessione
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onModifica} disabled={occupato}>
            Modifica
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={props.onChiediElimina}
            disabled={occupato}
          >
            Elimina
          </Button>
        </div>
      )}
    </div>
  )
}

/** Estrae un messaggio leggibile da un errore dell'IPC. */
function messaggioErrore(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  return 'Si e verificato un errore.'
}
