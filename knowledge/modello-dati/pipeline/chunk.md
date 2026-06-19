---
type: stage
title: Chunk
description: Porzioni indicizzabili con metadati di citazione.
tags: [pipeline, chunk]
---

# Chunk

Fase 4. Input: Unità da [Normalize](/modello-dati/pipeline/normalize.md).

## Scopo

Generare chunk per l'indice rispettando chunking e gate citazione.

## Chunking (DECISO)

1. **Default:** 1 comma = 1 chunk
2. **Split:** solo se comma > `MAX_CHUNK_TOKENS` (**TBD**)
3. Sub-chunk: stessi metadati citazione del comma padre; `chunk_seq` = 0, 1, …

## Metadati obbligatori (gate 3)

- `eli`
- `tipo` + `numero` (es. art. 3, comma 2)
- `vigenza_da`, `vigenza_a` (se applicabile)
- `testo`
- `content_hash` del testo chunk

## Gate (DECISO)

| Ambiente | Comportamento |
|----------|---------------|
| Prod (G1) | Metadati incompleti → respinto |
| Dev (G2) | Metadati incompleti → quarantena |

## Idempotenza

`(unita_id, chunk_seq, content_hash)`: testo invariato → skip.