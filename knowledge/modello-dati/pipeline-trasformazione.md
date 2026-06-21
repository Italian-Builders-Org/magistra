---
type: Processo
title: Pipeline di trasformazione
description: Dal download AKN di Normattiva fino all'indice vettoriale e al grafo dei riferimenti, preservando i metadati di citazione.
tags: [pipeline, ingest, chunking, embedding]
timestamp: 2026-06-21T00:00:00Z
---

# Pipeline di trasformazione

```mermaid
flowchart TD
    N(["Normattiva (API)"])
    P["Parsing AKN<br/>estrazione struttura (Work / Expression / Unità)"]
    T["Normalizzazione testo<br/>(preservando i riferimenti)"]
    C["Chunking per unità<br/>(articolo / comma, con metadati di citazione)"]
    E["Embedding"]
    R["Estrazione riferimenti"]
    IV[("Indice vettoriale")]
    G[("Grafo delle norme")]

    N -->|download AKN + metadati ELI| P
    P --> T
    T --> C
    T --> R
    C --> E
    E --> IV
    R --> G
```

**Principio chiave**: ogni [Chunk](/modello-dati/chunk.md) porta con sé i metadati necessari a costruire una **[citazione verificabile](/glossario/citazione-verificabile.md)** ([ELI](/glossario/eli.md) + articolo + comma + data di vigenza). Senza questi metadati il chunk non entra nell'indice.

Le fasi attingono dalla fonte [Normattiva](/fonti/normattiva.md) e alimentano l'[indice normativo](/architettura/indice-normativo.md).

## Specifica operativa v0.1

Bozza dettagliata (fasi, gate, confine API, decisioni team): [Come leggere la pipeline](/architettura/pipeline/leggere.md).
