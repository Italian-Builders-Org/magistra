---
type: Indice
title: Modello dati e parsing Akoma Ntoso
description: Come la piattaforma rappresenta una norma italiana a partire da Normattiva (Akoma Ntoso / ELI) e la trasforma in unità interrogabili.
tags: [modello-dati, akoma-ntoso, eli, rag]
timestamp: 2026-06-18T00:00:00Z
---

# Modello dati e parsing Akoma Ntoso

Questa cartella descrive come Magistra rappresenta una norma italiana a partire dai dati di Normattiva ([Akoma Ntoso](/glossario/akoma-ntoso.md) / [ELI](/glossario/eli.md)) e come la trasforma in unità interrogabili per la ricerca semantica e le citazioni.

> È una **bozza concettuale**: lo schema serve a ragionare sui dati, non è ancora un'implementazione.

## Concetti di base

- [Il modello FRBR](/modello-dati/frbr.md): Work / Expression / Manifestation / Item.
- [Identificazione: URI ELI](/modello-dati/uri-eli.md): chiave primaria stabile.
- [Struttura del documento AKN](/modello-dati/struttura-akn.md): articolo e comma.
- [Pipeline di trasformazione](/modello-dati/pipeline-trasformazione.md): panoramica, diagramma e rimando alla [specifica operativa](/architettura/pipeline/index.md).

## Entità del corpus normativo

- [Norma](/modello-dati/norma.md) (Work)
- [Versione](/modello-dati/versione.md) (Expression)
- [Unità](/modello-dati/unita.md) (articolo / comma)
- [Chunk](/modello-dati/chunk.md) (ricerca semantica)
- [Riferimento](/modello-dati/riferimento.md) (cross-reference)

## Entità del modello applicativo

Distinte dal corpus pubblico: rappresentano il lavoro dell'utente sui documenti (vivono nel [database applicativo](/architettura/database-applicativo.md)). La versione OSS è single-utente: non c'è un'entità "utente" né account.

- [Modello dati applicativo](/modello-dati/modello-applicativo.md): panoramica e relazioni.
- [Progetto](/modello-dati/progetto.md)
- [Documento](/modello-dati/documento.md) (file dell'utente)
- [Conversazione](/modello-dati/conversazione.md)
- [Messaggio](/modello-dati/messaggio.md)
- [Chiave API](/modello-dati/chiave-api.md)
