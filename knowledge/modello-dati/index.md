---
type: Indice
title: Modello dati e parsing Akoma Ntoso
description: Come la piattaforma rappresenta una norma italiana a partire da Normattiva (Akoma Ntoso / ELI) e la trasforma in unità interrogabili.
tags: [modello-dati, akoma-ntoso, eli, rag]
timestamp: 2026-07-05T00:00:00Z
---

# Modello dati e parsing Akoma Ntoso

Questa cartella descrive come Magistra rappresenta una norma italiana a partire dai dati di Normattiva ([Akoma Ntoso](../glossario/akoma-ntoso.md) / [ELI](../glossario/eli.md)) e come la trasforma in unità interrogabili per la ricerca semantica e le citazioni.

Lo schema qui descritto resta una **bozza concettuale descrittiva**, ma raccoglie le decisioni logiche già prese per guidare la prima implementazione, ingest e validazione senza vincolare il motore fisico.

## Concetti di base

- [Il modello FRBR](./frbr.md) — Work / Expression / Manifestation / Item.
- [Identificazione: URI ELI](./uri-eli.md) — identificatore normalizzato del Work logico.
- [Struttura del documento AKN](./struttura-akn.md) — articolo e comma.
- [Pipeline di trasformazione](./pipeline-trasformazione.md) — da Normattiva all'indice vettoriale.

## Entità del corpus normativo

- [Norma](./norma.md) (Work)
- [Versione](./versione.md) (Expression)
- [Unità](./unita.md) (articolo / comma)
- [Chunk](./chunk.md) (ricerca semantica)
- [Riferimento](./riferimento.md) (cross-reference)

## Decisioni schema corpus

| Entità | Chiave primaria | Relazioni principali |
|---|---|---|
| Norma | `eli` | 1 → N Versioni |
| Versione | `id` | N → 1 Norma tramite `norma_eli`; 1 → N Unità |
| Unità | `id` | N → 1 Versione tramite `versione_id`; gerarchia opzionale tramite `parent_id` |
| Chunk | `id` | N → 1 Unità tramite `unita_id` |
| Riferimento | `id` | collega Norma/Unità sorgente e Norma/Unità destinazione |

Manifestation e Item del modello FRBR non sono entità applicative separate nel MVP: i loro dati essenziali (formato, URI/file sorgente, hash, data acquisizione) sono metadati della [Versione](./versione.md) o degli artefatti di ingest. Si potranno promuovere a entità separate solo se servirà tracciare più rappresentazioni o più copie fisiche della stessa Expression.

## Entità del modello applicativo

Distinte dal corpus pubblico: rappresentano il lavoro dell'utente sui documenti (vivono nel [database applicativo](../architettura/database-applicativo.md)). La versione OSS è single-utente: non c'è un'entità "utente" né account.

- [Modello dati applicativo](./modello-applicativo.md) — panoramica e relazioni.
- [Progetto](./progetto.md)
- [Documento](./documento.md) (file dell'utente)
- [Conversazione](./conversazione.md)
- [Messaggio](./messaggio.md)
- [Chiave API](./chiave-api.md)

## Decisioni schema applicativo

| Entità | Chiave primaria | Relazioni principali |
|---|---|---|
| Progetto | `id` | 1 → N Documenti; 1 → N Conversazioni |
| Documento | `id` | N → 1 Progetto tramite `progetto_id` |
| Conversazione | `id` | N → 0..1 Progetto tramite `progetto_id` |
| Messaggio | `id` | N → 1 Conversazione tramite `conversazione_id` |
| Chiave API | `id` | configurazione locale dell'istanza, non legata a un utente |
