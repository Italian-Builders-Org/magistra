---
type: Processo
title: Refresh
description: Re-ingest incrementale e multivigenza.
tags: [pipeline, ops, multivigenza]
timestamp: 2026-06-21T00:00:00Z
---

# Refresh

Fase 7. Riattiva [Acquisizione](/architettura/pipeline/acquisizione.md) su cambiamenti.

## Scopo

Allineare l'indice a Normattiva senza full re-ingest del corpus a ogni run.

## Trigger

- Schedule (es. settimanale) su ELI monitorati
- Manuale su singolo `eli`
- Hash sorgente cambiato post-acquire

## Flusso incrementale

1. Confronta hash sorgente
2. Se invariato → skip
3. Se cambiato → pipeline su quella versione
4. Re-chunk / re-embed **solo** su unità con testo cambiato (`content_hash`)

## Multivigenza

- Ogni Expression distinta → Versione separata
- Versioni storiche restano in indice; retrieval con `query_date` le esclude se non vigenti

## MVP

Refresh sul sottoinsieme MVP (vedi [Ambito MVP](/requisiti/mvp.md)); comportamento full corpus **TBD** post-validazione.
