---
type: stage
title: Acquire
description: Acquisizione artefatti grezzi da Normattiva con provenance.
tags: [pipeline, normattiva]
---

# Acquire

Fase 1. Vedi [panoramica](/modello-dati/pipeline/pipeline-di-trasformazione.md).

## Scopo

Scaricare il file sorgente da Normattiva e registrarlo in object storage con provenance immutabile.

## Input

| Campo | Note |
|-------|------|
| `eli` | URI ELI dell'atto/versione |
| `export_type` | `originaria` \| `vigente` \| `multivigente` |
| `as_of_date` | Per export vigente |
| `format` | Preferenza `akn`; fallback `xml-nir`, `json` |

## Output

Manifest di acquisizione + file in object storage (es. MinIO):

- `acquisition_id`, `eli`, `source_url`, `format`, `export_type`
- `content_hash` (sha256)
- `storage_path`, `acquired_at`
- `license_note` (attribuzione)

## Idempotenza

Chiave: `(eli, export_type, as_of_date, format, content_hash)`.

Stesso hash → riusa manifest. Hash nuovo → nuova acquisizione.

## Errori principali

| Codice | Azione |
|--------|--------|
| `SOURCE_UNAVAILABLE` | Retry con backoff |
| `ELI_NOT_FOUND` | Skip + log |
| `FORMAT_UNSUPPORTED` | Quarantena |

## Metriche (TBD implementazione)

`acquire_bytes_total`, `acquire_duration_ms`, `acquire_retries`