---
type: Indice
title: Pipeline di trasformazione
description: Data plane da Normattiva all'indice interrogabile.
tags: [pipeline]
timestamp: 2026-06-21T00:00:00Z
---

# Pipeline di trasformazione

Entry point del **data plane**. Leggere prima: [Come leggere](/architettura/pipeline/leggere.md).

## Diagramma

```mermaid
flowchart LR
  subgraph ingest
    A[Acquisizione] --> B[Parsing]
    B --> C[Normalizzazione]
  end
  subgraph index
    C --> D[Chunk]
    D --> E[Embed + Index]
    C --> F[Estrazione riferimenti]
  end
  subgraph ops
    E --> G[Refresh]
    F --> G
    G -.-> A
  end
  E --> R[Retrieval service]
  R --> API[API layer]
```

## Fasi

| # | Fase | Documento |
|---|------|-----------|
| 1 | Acquisizione | [acquisizione.md](/architettura/pipeline/acquisizione.md) |
| 2 | Parsing | [parsing.md](/architettura/pipeline/parsing.md) |
| 3 | Normalizzazione | [normalizzazione.md](/architettura/pipeline/normalizzazione.md) |
| 4 | Chunk | [chunk.md](/architettura/pipeline/chunk.md) |
| 5 | Embed + Index | [embed-index.md](/architettura/pipeline/embed-index.md) |
| 6 | Estrazione riferimenti | [estrazione-riferimenti.md](/architettura/pipeline/estrazione-riferimenti.md) |
| 7 | Refresh | [refresh.md](/architettura/pipeline/refresh.md) |

## Documenti trasversali

- [Pipeline, panoramica e principi](/architettura/pipeline/pipeline-di-trasformazione.md)
- [Contratto retrieval ↔ API](/architettura/pipeline/contratto-retrieval-api.md)

## Principio cardine

> Ogni chunk in indice deve permettere una citazione verificabile: ELI + articolo/comma + vigenza. **In produzione, senza metadati completi il chunk non entra in indice (G1).**

## MVP pilota

Allineato ad [Ambito MVP](/requisiti/mvp.md): ingest di un **sottoinsieme** del corpus da Normattiva, sufficiente a validare ingest, chunk, citazioni e retrieval prima di scalare.

- **Ambito:** sottoinsieme del corpus (non l'intero catalogo Normattiva)
- **Pilota implementativo:** insieme ristretto di atti scelto dal team (es. L. 241/1990 tra gli altri); può includere più atti e più versioni dove servono i test
- **Percorso:** acquisizione → … → chunk → righe DB; pgvector **dopo** che righe e metadati sono corretti
- **Fixture eval:** golden queries con ELI/articolo/comma attesi (**TBD**, chi le scrive)
