---
type: Processo
title: Extract references
description: Grafo Riferimenti tra norme.
tags: [pipeline, cross-reference]
timestamp: 2026-06-19T00:00:00Z
---

# Extract references

Fase 6. Può procedere in parallelo o dopo normalize.

## Scopo

Estrarre collegamenti (rinvii, modifiche, abrogazioni, recepimenti UE) per il grafo norme.

## Output

- `da_eli`, `a_eli`, `tipo`, `confidence`, `resolution` (`resolved` \| `unresolved`)

## Strategia v0.1

| Livello | Metodo | In scope v0.1 |
|---------|--------|---------------|
| 1 | Elementi AKN (`<ref>`) | Sì |
| 2 | Pattern testuali (L. n. X/YYYY, D.Lgs., …) | Sì, best-effort |
| 3 | NLP / LLM | No, TBD |

Riferimenti `unresolved` restano in coda; non bloccano MVP.

## Uso runtime

Espansione opzionale nel retrieval; non sostituisce ricerca semantica principale.