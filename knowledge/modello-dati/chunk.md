---
type: Entità Dati
title: Chunk (ricerca semantica)
description: Porzione di testo indicizzata per il retrieval, con embedding, metadati di filtro e metadati di citazione.
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
| `metadati_filtro` | scalar fields co-locati col vettore nell'indice: `vigenza_da`, `vigenza_a`, `tipo_atto`, fonte e altri filtri |
| `metadati_citazione` | snapshot di eli, articolo, comma, vigenza → per la **[citazione](../glossario/citazione-verificabile.md)** |

I Chunk sono prodotti dalla [pipeline di trasformazione](./pipeline-trasformazione.md) e popolano l'[indice normativo](../architettura/indice-normativo.md).

## Metadati nell'indice

I metadati necessari al prefiltro non sono solo dati di display: devono stare nella stessa riga fisica dell'indice che contiene il vettore. L'[indice normativo](../architettura/indice-normativo.md) usa LanceDB con prefiltro nativo per metadato; quindi `vigenza_da`, `vigenza_a` e `tipo_atto` devono essere interrogabili come scalar fields prima della ricerca ANN.

`metadati_citazione` resta invece lo snapshot usato per mostrare e verificare la fonte citata nella risposta. Può contenere ELI, articolo, comma, testo della citazione e una rappresentazione leggibile della vigenza, ma non sostituisce `metadati_filtro`.

`embedding_ref` rimanda alla riga/vettore dell'indice. La compatibilità tra query e indice non si deduce dal singolo Chunk: è dichiarata dal manifest dell'indice, che deve specificare almeno modello di embedding, dimensione e versione/schema dei metadati.

## Relazioni e vincoli

- Un Chunk appartiene a una sola [Unità](./unita.md).
- La coppia (`unita_id`, `indice`) deve essere unica.
- `metadati_filtro` è obbligatorio per ogni Chunk indicizzato: un chunk privo di `vigenza_da`, `vigenza_a` o `tipo_atto` non deve entrare nell'indice.
- La vigenza per il filtro è un intervallo interrogabile (`vigenza_da` / `vigenza_a`), non una stringa di citazione.
- `metadati_citazione` è denormalizzato per display e audit: non sostituisce le relazioni verso Versione e Unità.
