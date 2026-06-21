---
type: Indice
title: Pipeline di trasformazione
description: Data plane da Normattiva all'indice interrogabile.
tags: [pipeline]
timestamp: 2026-06-21T00:00:00Z
---

# Pipeline di trasformazione

Entry point del **data plane**. Leggere prima: [Come leggere](/modello-dati/pipeline/leggere.md).

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
    E --> F[Estrazione riferimenti]
  end
  subgraph ops
    F --> G[Refresh]
    G -.-> A
  end
  E --> R[Retrieval service]
  R --> API[API layer]
```

## Fasi

| # | Fase | Documento |
|---|------|-----------|
| 1 | Acquisizione | [acquisizione.md](/modello-dati/pipeline/acquisizione.md) |
| 2 | Parsing | [parsing.md](/modello-dati/pipeline/parsing.md) |
| 3 | Normalizzazione | [normalizzazione.md](/modello-dati/pipeline/normalizzazione.md) |
| 4 | Chunk | [chunk.md](/modello-dati/pipeline/chunk.md) |
| 5 | Embed + Index | [embed-index.md](/modello-dati/pipeline/embed-index.md) |
| 6 | Estrazione riferimenti | [estrazione-riferimenti.md](/modello-dati/pipeline/estrazione-riferimenti.md) |
| 7 | Refresh | [refresh.md](/modello-dati/pipeline/refresh.md) |

## Documenti trasversali

- [Pipeline, panoramica e principi](/modello-dati/pipeline/pipeline-di-trasformazione.md)
- [Contratto retrieval ↔ API](/modello-dati/pipeline/contratto-retrieval-api.md)

## Principio cardine (DECISO)

> Ogni chunk in indice deve permettere una citazione verificabile: ELI + articolo/comma + vigenza. **In produzione, senza metadati completi il chunk non entra in indice (G1).**

## MVP pilota (DECISO)

Allineato ad [Ambito MVP](/requisiti/mvp.md): ingest di un **sottoinsieme** del corpus da Normattiva, sufficiente a validare ingest, chunk, citazioni e retrieval prima di scalare.

- **Ambito:** sottoinsieme del corpus (non l'intero catalogo Normattiva)
- **Pilota implementativo:** insieme ristretto di atti scelto dal team (es. L. 241/1990 tra gli altri); può includere più atti e più versioni dove servono i test
- **Percorso:** acquisizione → … → chunk → righe DB; pgvector **dopo** che righe e metadati sono corretti
- **Fixture eval:** golden queries con ELI/articolo/comma attesi (**TBD**, chi le scrive)