---
type: Concetto
title: Requisiti non funzionali
description: Vincoli di prestazioni, scalabilità, affidabilità, usabilità e portabilità, con le soglie target misurabili di latenza, risorse locali, dimensione dell'indice e disponibilità offline.
tags: [requisiti, prestazioni, affidabilita]
timestamp: 2026-07-05T00:00:00Z
---

# Requisiti non funzionali

Vincoli trasversali che valgono per tutte le [funzionalità](../funzionalita/index.md).

La tabella riassume i vincoli in forma qualitativa; le soglie numeriche verificabili sono fissate nella sezione [Soglie target misurabili](#soglie-target-misurabili).

| Categoria | Requisito (proposta) |
|---|---|
| **Prestazioni** | Risposta dell'[assistente](../funzionalita/assistente-legale.md) percepita come interattiva; risultati di [ricerca](../funzionalita/ricerca-normativa.md) in tempi brevi. Streaming della risposta token-per-token. |
| **Scalabilità** | L'[indice normativo](../architettura/indice-normativo.md) deve reggere l'intero corpus statale; le [operazioni multi-documento](../funzionalita/operazioni-multi-documento.md) un numero ragionevole di file per lotto (tetto iniziale provvisorio ~50, elastico sulle risorse locali). Lotti grandi: coda su [worker separato](../architettura/worker-ingest.md), avanzamento, risultati parziali e ripresa, esecuzione sequenziale o a concorrenza limitata per non bloccare l'assistente. La soglia esatta dipende dai target hardware. |
| **Affidabilità** | Nessuna risposta normativa senza fonte; degrado controllato se un [provider LLM](../architettura/provider-llm.md) non è disponibile. Il [calcolo di pene e termini](../funzionalita/calcolo-pena-termini.md) dev'essere **esatto e regolato**, non generato dall'LLM. Il batch normativo gira su un [worker separato](../architettura/worker-ingest.md): un re-ingest o un [AKN](../glossario/akoma-ntoso.md) rotto non deve abbattere l'assistente. |
| **Portabilità** | Deve girare interamente come [app desktop](../architettura/deployment.md) locale, con tutto impacchettato nel bundle; il [provider LLM](../architettura/provider-llm.md) resta intercambiabile. **Windows** è la piattaforma primaria dei primi studi tester, accanto a macOS/Linux. |
| **Usabilità** | Interfaccia in italiano; citazioni sempre raggiungibili in un clic; trasparenza sulle fonti usate. |
| **Osservabilità** | Tracciabilità di quali [chunk](../modello-dati/chunk.md) hanno prodotto una risposta, a supporto della [valutazione della qualità](./valutazione-qualita.md). |
| **Costi** | Uso della [API key](../architettura/gestione-api-key.md) dell'utente; nessun lock-in su un fornitore. |

Sicurezza e privacy hanno documenti dedicati: [Sicurezza](./sicurezza.md) e [Privacy e dati personali](./privacy-e-dati-personali.md).

## Soglie target misurabili

Le soglie qui sotto sono obiettivi di progetto verificabili, riferiti a due scale di corpus: la **scala MVP** (dell'ordine di 10⁵, fino a ~250k [chunk](../modello-dati/chunk.md)) e la **copertura piena** della legislazione statale (milioni di chunk).
Restano fuori da questi valori i requisiti hardware dell'**inferenza LLM**: Magistra è un client e non ospita modelli, quindi il carico di generazione ed [embedding](../glossario/embedding.md) grava sul [runtime scelto dall'utente](../architettura/runtime-modelli-locali.md), non sull'app.
I punti che richiedono verifica empirica continua (recall dell'[indice](../architettura/indice-normativo.md), footprint e modelli consigliati) sono misurati nella [valutazione di qualità](./valutazione-qualita.md) senza riaprire il contratto architetturale della prima implementazione.

### Latenza

Valori target sulle parti sotto il controllo dell'app (rete e generazione LLM escluse), misurati come p95:

| Operazione | Target scala MVP | Target corpus pieno |
|---|---|---|
| [Ricerca semantica](../glossario/ricerca-semantica.md) nell'[indice](../architettura/indice-normativo.md) (query ANN con prefiltro per metadato, dentro il motore) | < 200 ms | < 500 ms |
| [Ricerca normativa](../funzionalita/ricerca-normativa.md) lato UI (dal submit ai risultati mostrati) | < 1 s | < 1,5 s |
| Overhead dell'app nel flusso [assistente](../funzionalita/assistente-legale.md) ([pianificazione query](../architettura/pianificazione-query.md) + retrieval + costruzione del prompt, prima della chiamata al provider) | < 1 s | < 1,5 s |
| Avvio a freddo dell'app (fino a UI utilizzabile e indice montato via mmap) | < 5 s | < 5 s |

La **generazione della risposta** è in streaming token-per-token e deve risultare interattiva; il time-to-first-token e la velocità di emissione dipendono dal [provider LLM](../architettura/provider-llm.md) e dal modello scelti dall'utente, quindi non sono fissati qui.
Il target sulla ricerca dentro il motore è dirimente: è l'asse su cui `pgvector` in WASM degradava a centinaia di millisecondi sotto filtro, ragione della scelta di [LanceDB](../architettura/indice-normativo.md) col prefiltro nativo.

### Risorse locali (RAM e disco)

Riferite all'**app** (Electron + [PGlite](../architettura/database-applicativo.md) + accesso all'indice), esclusa l'inferenza:

- **RAM**: l'app deve restare utilizzabile entro ~2 GB di memoria residente, oltre al sistema operativo. L'[indice LanceDB](../architettura/indice-normativo.md) è disk-based (mmap) e non viene caricato interamente in RAM, quindi la memoria **non scala** con la dimensione del corpus.
- **Disco**: il bundle dell'app è dell'ordine di alcune centinaia di MB; l'indice normativo è la voce dominante. Spazio libero consigliato: **≥ 10 GB**, per ospitare l'indice completo, l'area di staging di un aggiornamento (lo [swap atomico](../architettura/distribuzione-indice.md) richiede spazio per due copie durante l'attivazione) e il [database applicativo](../architettura/database-applicativo.md) con i documenti dell'utente.

### Dimensione del corpus e dell'indice

I vettori sono a **768 dimensioni** (modello `snowflake-arctic-embed-m-v2.0`, open-weight, usato nel benchmark di scala), pari a circa 3 KB per vettore a piena precisione:

- **Scala MVP** (~10⁵–250k chunk, indice flat esatto): ordine di **1–2 GB** su disco (vettori, testo e metadati di citazione).
- **Copertura piena** (≈668k articoli della legislazione statale, milioni di chunk una volta segmentati per unità): a piena precisione l'ordine è di alcune **decine di GB**; la variante **RaBitQ** (1-bit con rerank a piena precisione) riconduce i soli vettori all'ordine dei **pochi GB**, compatibile con i segmenti da 2 GiB del [canale GitHub Releases](../architettura/distribuzione-indice.md). La variante distribuita è dichiarata nel manifest dell'indice e verificata contro la recall sotto filtro misurata su dati veri.

L'indice si distribuisce come [pacchetto dati separato read-only](../architettura/distribuzione-indice.md): starter minimo nel bundle più download dell'indice completo al primo avvio.

### Disponibilità offline

Magistra è un client e **non esegue modelli** (né generativi né di [embedding](../glossario/embedding.md)): l'operatività offline dipende quindi da **dove** l'utente ha configurato i due endpoint. Le funzioni si dividono così:

- **Sempre offline**, senza alcuna dipendenza di rete, perché tutto è locale: navigazione, lettura dei documenti dell'utente, [citazioni verificabili](../glossario/citazione-verificabile.md) e apertura dell'[indice](../architettura/indice-normativo.md).
- **[Ricerca semantica](../glossario/ricerca-semantica.md)**: richiede di embeddare la query con l'**endpoint di embedding configurato**, che deve servire lo **stesso** modello dell'indice (`snowflake-arctic-embed-m-v2.0`). È offline **solo se** quell'endpoint è un [runtime locale](../architettura/runtime-modelli-locali.md); con un embedder remoto serve la rete e i dati escono dalla macchina. Poiché Magistra non esegue l'embedder, disporre di un endpoint di embedding è una **precondizione a carico dell'utente**, non una funzione garantita dall'app.
- **Generazione della risposta**: **offline** quando l'utente usa un runtime locale; richiede rete **solo** se sceglie un [provider remoto](../architettura/provider-llm.md), scelta esplicita che fa uscire i dati.

La **piena operatività offline** (ricerca semantica + generazione senza che alcun dato lasci la macchina) è quindi possibile, ma **presuppone endpoint locali** sia per l'embedding sia per la generazione: è la configurazione che massimizza la [riservatezza](./privacy-e-dati-personali.md), non il comportamento predefinito.
La rete resta comunque necessaria per il download iniziale dell'indice al primo avvio e per gli aggiornamenti opzionali di app e indice. Nessuna telemetria o chiamata obbligatoria a servizi del team è necessaria per usare il prodotto.
