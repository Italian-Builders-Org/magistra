---
type: Entità Dati
title: Unità (articolo / comma)
description: Entità che rappresenta un'unità strutturale del testo (articolo, comma, lettera) con il suo percorso gerarchico.
tags: [entita, articolo, comma]
timestamp: 2026-07-05T00:00:00Z
---

# Unità (articolo / comma)

Unità strutturale del testo normativo, derivata dalla [struttura del documento AKN](./struttura-akn.md).

| Campo | Descrizione |
|---|---|
| `id` | identificativo unità, **chiave primaria** |
| `versione_id` | FK verso [Versione](./versione.md).`id` |
| `parent_id` | FK opzionale verso Unità padre, per gerarchia articolo → comma → lettera |
| `tipo` | articolo / [comma](../glossario/comma.md) / lettera |
| `numero` | numero locale, es. `3`, `2`, `a` |
| `percorso` | path gerarchico stabile nella versione, es. `art-3/comma-2` |
| `ordine` | posizione ordinabile nel testo della versione |
| `testo` | testo pulito dell'unità |
| `eli_unita` | URI [ELI](../glossario/eli.md) puntuale, opzionale perché non tutte le fonti lo espongono allo stesso livello |

## Relazioni e vincoli

- Un'Unità appartiene a una sola [Versione](./versione.md).
- Da un'Unità si generano uno o più [Chunk](./chunk.md).
- `eli_unita` non è una FK obbligatoria: quando manca, la citazione si costruisce da `versione_id`, `percorso`, tipo e numero.
- La coppia (`versione_id`, `percorso`) deve essere unica.
