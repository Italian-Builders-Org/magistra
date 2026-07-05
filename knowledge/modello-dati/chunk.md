---
type: Entità Dati
title: Chunk (ricerca semantica)
description: Porzione di testo indicizzata per il retrieval, con embedding e metadati di citazione.
tags: [entita, chunk, embedding, rag]
timestamp: 2026-07-05T00:00:00Z
---

# Chunk (ricerca semantica)

Porzione di testo indicizzata per il retrieval. Vedi [chunk](../glossario/chunk.md) e [ricerca semantica](../glossario/ricerca-semantica.md).

| Campo | Descrizione |
|---|---|
| `id` | identificativo chunk, **chiave primaria** |
| `unita_id` | FK verso [Unità](./unita.md).`id` |
| `indice` | ordine del chunk dentro l'unità |
| `testo` | porzione di testo |
| `embedding_ref` | riferimento al [vettore](../glossario/embedding.md) nell'indice fisico |
| `metadati_citazione` | snapshot di eli, articolo, comma, vigenza → per la **[citazione](../glossario/citazione-verificabile.md)** |

I Chunk sono prodotti dalla [pipeline di trasformazione](./pipeline-trasformazione.md) e popolano l'[indice normativo](../architettura/indice-normativo.md).

## Relazioni e vincoli

- Un Chunk appartiene a una sola [Unità](./unita.md).
- La coppia (`unita_id`, `indice`) deve essere unica.
- `metadati_citazione` è denormalizzato per retrieval e audit: non sostituisce le relazioni verso Versione e Unità.
