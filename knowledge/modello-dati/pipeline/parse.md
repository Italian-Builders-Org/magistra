---
type: stage
title: Parse
description: Parsing Akoma Ntoso e metadati FRBR/ELI.
tags: [pipeline, akn, frbr]
---

# Parse

Fase 2. Input: output di [Acquire](/modello-dati/pipeline/acquire.md).

## Scopo

Produrre albero AKN strutturato + identificazione FRBR/ELI.

## Output (concettuale)

- `eli_work`, `eli_expression` (se presente)
- Blocchi FRBR (Work, Expression, Manifestation)
- Riferimenti ad articoli/commi nell'albero
- `parse_version`: versione parser interno

## Regole

- Fonte canonica: **Akoma Ntoso**
- Fallback **XML NIR** solo se AKN assente; flag `parser: nir-fallback`
- Gate 1: XML valido, FRBR/ELI presenti; altrimenti quarantena

## Idempotenza

`(acquisition_id, parse_version)`: bump `parse_version` forza re-parse.

## Errori principali

`XML_MALFORMED`, `MISSING_FRBR`, `MISSING_ELI`, `UNKNOWN_SCHEMA` → quarantena + alert su `UNKNOWN_SCHEMA`.