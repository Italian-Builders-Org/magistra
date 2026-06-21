---
type: Processo
title: Come leggere la documentazione pipeline
description: Chiave di lettura per team, implementers, reviewer e agenti.
tags: [pipeline, guida]
timestamp: 2026-06-21T00:00:00Z
---

# Come leggere la documentazione pipeline

**Stato:** bozza v0.1. Orienta il lavoro; non è implementazione né schema DB definitivo.

## Per chi

| Ruolo | Cosa leggere | Cosa puoi saltare |
|-------|--------------|-------------------|
| **Team** | Questo file + [panoramica](/architettura/pipeline/pipeline-di-trasformazione.md) + [contratto API](/architettura/pipeline/contratto-retrieval-api.md) | Dettaglio per-stage (salvo curiosità) |
| **Implementer ingest** | Panoramica → stage `acquisizione` … `chunk` (in ordine) | `embed-index` se non tocchi vettori ancora |
| **Implementer retrieval** | `embed-index` + `contratto-retrieval-api` | Ingest se fuori dal proprio perimetro |
| **Reviewer** | Panoramica + tabella decisioni (sotto) + contratto API | n/a |
| **Agente / contributor** | Leggere frontmatter `type`; rispettare legenda TBD/BOZZA | Non inferire ciò che è TBD |

## Ordine consigliato

1. [pipeline-di-trasformazione.md](/architettura/pipeline/pipeline-di-trasformazione.md)
2. [contratto-retrieval-api.md](/architettura/pipeline/contratto-retrieval-api.md)
3. Stage in sequenza: acquisizione → parsing → normalizzazione → chunk → embed-index → estrazione-riferimenti → refresh

## Legenda

| Etichetta | Significato |
|-----------|-------------|
| **TBD** | Da chiudere prima di implementare quella parte |
| **BOZZA** | Può cambiare con PR e review |

## Riepilogo (v0.1)

| Tema | Decisione |
|------|-----------|
| MVP | Sottoinsieme del corpus [Normattiva](/fonti/normattiva.md), allineato ad [Ambito MVP](/requisiti/mvp.md); pilota implementativo ristretto (es. poche leggi) |
| Chunking | 1 comma = 1 chunk; split solo sopra soglia token (**TBD**) |
| Vigenza | `query_date` assente → default **oggi** (testo vigente a oggi) |
| Gate citazione | **G1** prod: respinto; **G2** dev: quarantena |
| Confine API | **H1** target (`POST /internal/retrieve`); H3 in dev **TBD con il team** |
| Embedding | Modello **TBD** post-pilota; interfaccia `EmbeddingProvider` swappabile |
| FinOps | **Escluso** da v0.1 |
| Ordine lavoro | Ingest → chunk → righe DB **prima** di pgvector |
| Responsabile ingest | **TBD** |

## Cosa questa bozza non fa

- Non sceglie il modello di embedding (pilota prima, poi decisione)
- Non include FinOps né budget
- Non copre giurisprudenza ingest
- Non sostituisce schema database o codice
- Non definisce prompt LLM (layer API)

## Allineamento richiesto

Prima che parta implementazione su pgvector o ingest a scala:

- **Data plane e API layer**: contratto retrieval ↔ API
- **Team**: H3 in dev sì/no; responsabile ingest
