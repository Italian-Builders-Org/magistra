---
type: Processo
title: Embed + Index
description: Vettori e scrittura su pgvector.
tags: [pipeline, embedding, pgvector]
timestamp: 2026-06-19T00:00:00Z
---

# Embed + Index

Fase 5. Input: Chunk ammessi da [Chunk](/modello-dati/pipeline/chunk.md).

## Scopo

Calcolare embedding e persistere vettore + metadati in PostgreSQL/pgvector.

**Prerequisito (DECISO):** righe chunk corrette su MVP pilota **prima** di attivare questa fase a scala.

## EmbeddingProvider (TBD post-pilota)

Interfaccia swappabile:

- `modelId`, `dimensions`
- `embed(texts)` → vettori
- `max_tokens`: vincola chunking upstream

**Non deciso in v0.1:** quale modello (es. all-MiniLM, Qwen3-Embedding, altro). Scelta dopo pilota L. 241/1990 con golden queries.

**Regola:** cambio `model_id` → re-embed completo.

## Dedup

Non ri-embeddare se `(chunk_id, content_hash, model_id)` già presente.

## Indice

- Colonna `embedding vector(N)`; N dal modello attivo
- Indici su metadati: `eli`, vigenza, `tipo_atto`
- Ricerca: semantica + filtri (dettaglio retrieval nel [contratto API](/modello-dati/pipeline/contratto-retrieval-api.md))

## Errori principali

`EMBED_PROVIDER_TIMEOUT` (retry), `EMBED_DIMENSION_MISMATCH` (block deploy), `INDEX_WRITE_FAILED` (retry).