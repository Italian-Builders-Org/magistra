---
type: Componente
title: Runtime dei modelli locali
description: Runtime self-hosted (Ollama, LM Studio, llama.cpp) che l'utente esegue e collega a Magistra per LLM ed embedding; Magistra è un client e non esegue né ospita modelli.
tags: [llm, locale, embedding]
timestamp: 2026-07-05T00:00:00Z
---

# Runtime dei modelli locali

Magistra **non esegue né impacchetta modelli**: è un client. L'utente fornisce l'accesso a un modello di cui già dispone e Magistra lo interroga tramite il [provider configurabile](./provider-llm.md). L'accesso ha due forme: una [chiave API](./gestione-api-key.md) per un [provider remoto](./provider-llm.md), oppure l'indirizzo (con le eventuali credenziali) di un **runtime self-hosted** che l'utente gestisce.

Questo documento descrive i runtime self-hosted supportati e come Magistra vi si collega.

«Locale» non vuol dire per forza *stessa macchina*: il runtime gestito dall'utente può girare sul suo computer o su un **server nella rete dello studio**. La garanzia di riservatezza è massima quando gira sulla stessa macchina, dove nessun dato la lascia, e resta forte quando vive su una macchina che lo studio controlla; in entrambi i casi i dati non vengono affidati a un servizio cloud di terzi.

Magistra non raccomanda un modello finché non è **verificato**: la scelta del modello, generativo e di embedding, è demandata alla [valutazione di qualità](../requisiti/valutazione-qualita.md) sull'italiano giuridico e non a una stima a priori.

## Dove gira il modello: macchina o rete dello studio

Il runtime è gestito dall'utente e Magistra vi si collega come client. Due topologie self-hosted, che cambiano l'autenticazione richiesta e il confine della privacy:

| Topologia | Come | Autenticazione | Dove restano i dati |
|---|---|---|---|
| **Servizio su `localhost`** | Ollama / LM Studio / llama.cpp sulla stessa macchina dell'app | di norma nessuna chiave | non lasciano il dispositivo |
| **Server sulla rete locale** | lo stesso runtime su un host della LAN dello studio | **spesso richiesta** (API key, token o reverse proxy) | nella rete controllata dallo studio, ma escono dalla singola macchina |

Un endpoint self-hosted può quindi richiedere o meno un segreto: la [gestione delle API key](./gestione-api-key.md) tratta la chiave come **opzionale** e permette di configurare `base_url` e, dove serve, l'autenticazione.

## Due carichi diversi: embedding e generazione

Il [flusso RAG](./flusso-rag.md) usa due modelli con profili opposti, entrambi raggiunti da Magistra come endpoint:

- **Modello di embedding**: trasforma query e [chunk](../modello-dati/chunk.md) in [embedding](../glossario/embedding.md). Serve **a ogni domanda**, anche quando la generazione è su un provider remoto, perché la query va embeddata per interrogare l'[indice](./indice-normativo.md). È piccolo e con footprint contenuto.
- **LLM generativo**: pianifica le query e sintetizza la risposta. È pesante e determina i requisiti hardware del runtime che lo ospita.

## Runtime per la generazione

I runtime self-hosted supportati eseguono modelli **quantizzati** (formato GGUF) ed espongono un'API **OpenAI-compatibile**: Magistra li raggiunge con lo stesso adattatore di un provider remoto (via Vercel AI SDK), dietro il confine del [provider configurabile](./provider-llm.md). In tutti i casi è **l'utente** a installare e avviare il runtime.

| Runtime | Cos'è | Note |
|---|---|---|
| **[Ollama](https://ollama.com/)** (consigliato) | Servizio che scarica e serve modelli GGUF | Installazione semplice e cross-platform, gestione dei modelli inclusa; default consigliato all'utente |
| **[LM Studio](https://lmstudio.ai/)** | Applicazione desktop che serve modelli GGUF | Alternativa con interfaccia grafica per gestire i modelli |
| **[llama.cpp](https://github.com/ggml-org/llama.cpp)** (`llama-server`) | Server HTTP del motore `llama.cpp` | Opzione più vicina al motore, per utenti avanzati e per il server della rete |

## Runtime per l'embedding

Anche l'embedding è raggiunto come endpoint: lo stesso runtime self-hosted (Ollama e LM Studio espongono un endpoint di embedding) oppure un provider che serva il modello richiesto. Magistra non calcola gli embedding da sé.

### Vincolo: stesso modello per indice e query

Query e corpus **devono** usare lo **stesso** modello di embedding con lo stesso numero di dimensioni: sono confrontabili solo vettori prodotti dallo stesso modello.
L'[indice distribuito già pronto](./deployment.md) è costruito dalla [pipeline di trasformazione](../modello-dati/pipeline-trasformazione.md) con un modello **fisso**; l'endpoint di embedding configurato dall'utente deve servire **quello stesso modello**. Cambiare modello di embedding impone di **ricostruire l'indice**.

Per rendere il vincolo verificabile, l'[indice](./indice-normativo.md) **dichiara nel proprio manifest** il modello di embedding usato (nome, dimensioni e versione), così l'app può rifiutare un endpoint che serve un modello incompatibile invece di produrre risultati silenziosamente sbagliati.

## Hardware: fuori dal perimetro di Magistra

Poiché Magistra **non ospita i modelli**, non fissa requisiti hardware per l'inferenza: dipendono dal modello e dal runtime scelti dall'utente e gravano sulla macchina che li esegue (il suo computer o il server dello studio), non sull'app, che resta leggera (vedi [deployment](./deployment.md)).
Le indicazioni hardware per i modelli effettivamente validati saranno definite insieme a quella scelta, con la [valutazione di qualità](../requisiti/valutazione-qualita.md) e la definizione dei target hardware, da cui dipendono anche i [requisiti non funzionali](../requisiti/requisiti-non-funzionali.md).
