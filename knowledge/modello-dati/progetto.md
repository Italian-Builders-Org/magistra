---
type: Entità Dati
title: Progetto
description: Spazio di lavoro che raggruppa i documenti e le conversazioni dell'utente attorno a una pratica.
tags: [entita, progetto, modello-app]
timestamp: 2026-07-05T00:00:00Z
---

# Progetto

Raggruppa il lavoro attorno a una pratica o a un cliente. È il dato dietro la funzionalità [Progetti](../funzionalita/progetti.md).

| Campo | Descrizione |
|---|---|
| `id` | identificativo (chiave primaria) |
| `nome` | nome del progetto |
| `creato_il` | data di creazione |
| `aggiornato_il` | ultima modifica significativa |

## Relazioni

- Contiene 0..N [Documenti](./documento.md) e 0..N [Conversazioni](./conversazione.md).

> Single-utente: il progetto non ha proprietario né membri e non è condiviso; non esiste multi-utenza.

Parte del [modello dati applicativo](./modello-applicativo.md).
