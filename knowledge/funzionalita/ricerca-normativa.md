---
type: Concetto
title: Ricerca normativa
description: Ricerca per concetto e per parola chiave su leggi, decreti e codici, con filtri per tipo di atto, data e vigenza.
tags: [ricerca, ricerca-semantica, retrieval]
timestamp: 2026-06-20T00:00:00Z
---

# Ricerca normativa

Permette di trovare norme e singole [unità](/modello-dati/unita.md) (articoli, commi) sul corpus, anche senza conoscere le parole esatte del testo.

## Modalità

- **[Ricerca semantica](/glossario/ricerca-semantica.md)**: per concetto, basata sugli [embedding](/glossario/embedding.md) dei [chunk](/modello-dati/chunk.md).
- **Per parola chiave**: ricerca lessicale classica, utile per termini e numeri di articolo esatti.
- **Ibrida**: combinazione delle due, con [reranking](/glossario/reranking.md) dei risultati.

## Pianificazione delle query

Anche nella ricerca diretta la query dell'utente non viene embeddata grezza: passa per la stessa [pianificazione delle query](/architettura/pianificazione-query.md) agentica usata dall'[assistente](/funzionalita/assistente-legale.md). Il sistema **riformula** la richiesta in una o più query di ricerca mirate (sinonimi, terminologia giuridica, sotto-ricerche), le embedda e ne unisce i risultati con [reranking](/glossario/reranking.md).

Vale per la modalità semantica e ibrida; la ricerca per sola parola chiave resta letterale.

## Filtri

- Tipo di atto (legge, decreto legislativo, codice…).
- Data dell'atto e **data di [vigenza](/glossario/vigenza.md)** (cosa era in vigore a una certa data; vedi [multivigenza](/glossario/multivigenza.md)).
- Fonte ([Normattiva](/fonti/normattiva.md), [EUR-Lex](/fonti/eur-lex.md), …).

Ogni risultato riporta i metadati necessari alla [citazione verificabile](/glossario/citazione-verificabile.md) e linka al testo ufficiale.
Attinge all'[indice normativo](/architettura/indice-normativo.md).
