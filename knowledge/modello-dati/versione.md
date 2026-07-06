---
type: Entità Dati
title: Versione (Expression)
description: Entità che rappresenta una versione specifica di una norma nel tempo; mappa il livello Expression di FRBR.
tags: [entita, expression, vigenza]
timestamp: 2026-07-05T00:00:00Z
---

# Versione (Expression)

Corrisponde al livello **Expression** del [modello FRBR](./frbr.md): una versione specifica di una [Norma](./norma.md) nel tempo.

| Campo | Descrizione |
|---|---|
| `id` | identificativo versione, **chiave primaria** |
| `norma_eli` | FK verso [Norma](./norma.md).`eli` |
| `iri_akn_expression` | IRI/URI dell'Expression Akoma Ntoso, se disponibile dalla fonte; non è un `eli:LegalExpression` del vocabolario ELI italiano |
| `vigenza_da` / `vigenza_a` | intervallo di [vigenza](../glossario/vigenza.md); `vigenza_a` nullo indica versione aperta |
| `stato` | vigente / abrogata / originaria |
| `lingua` | lingua dell'Expression, default `it` |
| `source_uri` | URI o URL della manifestazione sorgente usata per ingest |
| `source_hash` | hash del file sorgente acquisito |
| `acquisita_il` | data di acquisizione della fonte |

## Relazioni e vincoli

- Una Versione appartiene a una sola [Norma](./norma.md).
- Una Versione contiene molte [Unità](./unita.md).
- La coppia (`norma_eli`, `vigenza_da`, `lingua`) deve essere unica nel profilo di corpus.
- Gli URI Normattiva `ORIGINAL` e `CONSOLIDATED` non vanno trattati come ELI Expression: nel profilo italiano ELI la Expression codifica soprattutto la lingua, mentre gli URI consolidati sono risorse ELI di livello Work collegate tramite `eli:consolidates`.
- Manifestation e Item FRBR non sono tabelle MVP: `source_uri`, `source_hash` e `acquisita_il` conservano la traccia minima della fonte fisica.
