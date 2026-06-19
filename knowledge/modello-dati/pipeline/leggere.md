---
type: guide
title: Come leggere la documentazione pipeline
description: Chiave di lettura per team, implementers, reviewer e agenti.
tags: [pipeline, guida]
timestamp: 2026-06-19
---

# Come leggere la documentazione pipeline

**Stato:** bozza v0.1. Orienta il lavoro; non è implementazione né schema DB definitivo.

## Per chi

| Ruolo | Cosa leggere | Cosa puoi saltare |
|-------|--------------|-------------------|
| **Team** | Questo file + [panoramica](/modello-dati/pipeline/pipeline-di-trasformazione.md) + [contratto API](/modello-dati/pipeline/contratto-retrieval-api.md) | Dettaglio per-stage (salvo curiosità) |
| **Implementer ingest** | Panoramica → stage `acquire` … `chunk` (in ordine) | `embed-index` se non tocchi vettori ancora |
| **Implementer retrieval** | `embed-index` + `contratto-retrieval-api` | Ingest se fuori dal proprio perimetro |
| **Reviewer** | Panoramica + tabella decisioni (sotto) + contratto API | n/a |
| **Agente / contributor** | Leggere frontmatter `type`; rispettare legenda DECISO/TBD | Non inferire ciò che è TBD |

## Ordine consigliato

1. [pipeline-di-trasformazione.md](/modello-dati/pipeline/pipeline-di-trasformazione.md)
2. [contratto-retrieval-api.md](/modello-dati/pipeline/contratto-retrieval-api.md)
3. Stage in sequenza: acquire → parse → normalize → chunk → embed-index → extract-references → refresh

## Legenda

| Etichetta | Significato |
|-----------|-------------|
| **DECISO** | Allineato in discussione team (v0.1) |
| **TBD** | Da chiudere prima di implementare quella parte |
| **BOZZA** | Può cambiare con PR e review |

## Decisioni DECISO (v0.1)

| Tema | Decisione |
|------|-----------|
| MVP | Una legge pilota (es. L. 241/1990), una versione |
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
