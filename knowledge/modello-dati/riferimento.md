---
type: Entità Dati
title: Riferimento (cross-reference)
description: Entità che rappresenta un collegamento tra norme/unità (rinvio, modifica, abrogazione, recepimento UE).
tags: [entita, riferimento, grafo]
timestamp: 2026-07-05T00:00:00Z
---

# Riferimento (cross-reference)

Collegamento tra norme o unità, base del grafo delle norme.

| Campo | Descrizione |
|---|---|
| `id` | identificativo riferimento, **chiave primaria** |
| `da_norma_eli` | FK opzionale verso [Norma](./norma.md).`eli`, lato citante |
| `da_unita_id` | FK opzionale verso [Unità](./unita.md).`id`, lato citante |
| `a_norma_eli` | FK opzionale verso [Norma](./norma.md).`eli`, lato citato |
| `a_unita_id` | FK opzionale verso [Unità](./unita.md).`id`, lato citato |
| `tipo` | rinvio, modifica, [abrogazione](../glossario/abrogazione.md), [recepimento](../glossario/recepimento.md) UE |
| `testo_riferimento` | testo originale del riferimento estratto |
| `confidence` | confidenza dell'estrazione, se prodotta dalla pipeline |
| `source_span` | posizione nel testo sorgente, se disponibile |

I Riferimenti sono estratti nell'ultima fase della [pipeline di trasformazione](./pipeline-trasformazione.md).

## Relazioni e vincoli

- Ogni riferimento deve avere almeno un endpoint sorgente (`da_norma_eli` o `da_unita_id`) e almeno un endpoint destinazione (`a_norma_eli` o `a_unita_id`).
- Quando il riferimento è puntuale a un comma/articolo si usa `*_unita_id`; quando è solo all'atto si usa `*_norma_eli`.
- La chiave primaria è `id`: non si usa una PK composta sui soli ELI, perché lo stesso testo può contenere più riferimenti tra le stesse norme con tipo, fonte o span diversi.
