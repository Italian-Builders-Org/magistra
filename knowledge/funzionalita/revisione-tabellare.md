---
type: Concetto
title: Revisione tabellare
description: Estrazione strutturata di informazioni da molti documenti in una tabella, una domanda per colonna e un documento per riga.
tags: [documenti, revisione-tabellare, estrazione]
timestamp: 2026-06-20T00:00:00Z
---

# Revisione tabellare

Modalità di analisi in blocco: a partire da un insieme di [documenti](/modello-dati/documento.md), l'utente definisce una serie di **domande/colonne** e ottiene una **tabella** con un documento per riga e una risposta per cella.

## Esempio

| Documento | Scadenza | Foro competente | Clausola di recesso |
|---|---|---|---|
| Contratto A | 31/12/2026 | Milano | Sì, art. 7 |
| Contratto B |: | Roma | No |

## Cosa fa

- Per ogni cella, l'assistente estrae l'informazione dal documento e, dove pertinente, riporta la fonte (clausola o riferimento normativo).
- Le colonne possono essere salvate come **preset** in un [workflow](/funzionalita/workflow.md) e riutilizzate.
- I risultati sono esportabili e possono alimentare una [conversazione](/modello-dati/conversazione.md) di approfondimento.

## Relazioni

Caso particolare delle [operazioni multi-documento](/funzionalita/operazioni-multi-documento.md), orientato all'**estrazione comparabile** di dati.
Si appoggia all'[assistente legale](/funzionalita/assistente-legale.md) e alla [conversione documenti](/architettura/conversione-documenti.md).
