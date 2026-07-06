---
type: Entità Dati
title: Messaggio
description: Singolo turno di una conversazione (domanda dell'utente o risposta dell'assistente) con le citazioni e i chunk utilizzati.
tags: [entita, messaggio, citazioni]
timestamp: 2026-07-05T00:00:00Z
---

# Messaggio

Un singolo turno di una [Conversazione](./conversazione.md): la domanda dell'utente o la risposta dell'assistente.

| Campo | Descrizione |
|---|---|
| `id` | identificativo (chiave primaria) |
| `conversazione_id` | FK verso [Conversazione](./conversazione.md).`id` |
| `ordine` | posizione del messaggio nella conversazione |
| `ruolo` | utente / assistente / sistema |
| `contenuto` | testo del messaggio |
| `query_generate` | le [query di ricerca](../architettura/pianificazione-query.md) pianificate dall'assistente per questo turno |
| `citazioni` | elenco delle [citazioni verificabili](../glossario/citazione-verificabile.md) prodotte |
| `chunk_usati` | i [Chunk](./chunk.md) recuperati a sostegno della risposta |
| `creato_il` | timestamp |

## Note

- I campi `query_generate` e `chunk_usati` rendono **tracciabile** come è stata costruita la risposta — dalle query pianificate alle fonti recuperate — a supporto della [valutazione della qualità](../requisiti/valutazione-qualita.md).
- Le citazioni nascono dal [flusso RAG](../architettura/flusso-rag.md).
- La coppia (`conversazione_id`, `ordine`) deve essere unica.

Parte del [modello dati applicativo](./modello-applicativo.md).
