---
type: Processo
title: Normalizzazione
description: Entità Norma, Versione, Unità dal documento analizzato.
tags: [pipeline, norma, versione, unita]
timestamp: 2026-06-21T00:00:00Z
---

# Normalizzazione

Fase 3. Input: output di [Parsing](/architettura/pipeline/parsing.md).

## Scopo

Mappare l'albero AKN su entità persistenti senza alterare il significato del testo.

## Output

| Entità | Campi principali |
|--------|------------------|
| **Norma** | `eli`, `tipo_atto`, `numero`, `data`, `titolo`, `fonte` |
| **Versione** | `vigenza_da`, `vigenza_a`, `stato` (`vigente` \| `originaria` \| `abrogata`) |
| **Unità** | `tipo`, `numero`, `percorso`, `testo`, `eli_unita` (se disponibile) |

## Mapping AKN

| AKN | Unità |
|-----|-------|
| `<article>` | `articolo` |
| `<paragraph>` | `comma` |
| lettere / punti | `lettera` |

Unità citabile predefinita: **comma**.

## Vigenza

Derivata da FRBRExpression + `export_type` dell'acquisizione.

## Gate 2

Almeno un'unità con testo; intervallo vigenza coerente.

## Idempotenza

- Norma: upsert su `eli`
- Versione: upsert su chiave versione
- Unità: upsert su `(versione_id, percorso)`
