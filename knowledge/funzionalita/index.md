---
type: Indice
title: Funzionalità
description: Le capacità che la piattaforma offre all'utente: assistente, ricerca, analisi e redazione documenti, revisione tabellare, workflow e progetti.
tags: [funzionalita, prodotto, assistente]
timestamp: 2026-06-20T00:00:00Z
---

# Funzionalità

Questa cartella descrive **cosa fa** la piattaforma dal punto di vista dell'utente: ogni funzionalità è un concetto autonomo, indipendente dall'implementazione.
È il riferimento per il documento di specifiche.

> Bozza concettuale. La selezione di ciò che entra nella prima release è in [Ambito MVP](/requisiti/mvp.md).

## Assistente e conoscenza normativa

- [Assistente legale (chat)](/funzionalita/assistente-legale.md): dialogo in linguaggio naturale con risposte ancorate alle fonti.
- [Ricerca normativa](/funzionalita/ricerca-normativa.md): ricerca semantica e per parola chiave sul corpus.
- [Confronto versioni](/funzionalita/confronto-versioni.md): navigazione del testo vigente e delle versioni storiche.
- [Riferimenti incrociati](/funzionalita/riferimenti-incrociati.md): collegamenti automatici tra norme, codici e diritto UE.
- [Verifica delle citazioni giurisprudenziali](/funzionalita/verifica-citazioni-giurisprudenza.md): controllo che una sentenza citata esista e sia pertinente.

## Lavoro sui documenti

- [Analisi di documenti](/funzionalita/analisi-documenti.md): caricamento di contratti e atti per riassunti, clausole e verifica dei riferimenti.
- [Redazione di documenti](/funzionalita/redazione-documenti.md): generazione di bozze a partire da istruzioni e modelli.
- [Revisione con modifiche tracciate](/funzionalita/revisione-tracciata.md): editing puntuale con tracked changes e versioning.
- [Operazioni multi-documento](/funzionalita/operazioni-multi-documento.md): applicare la stessa modifica o analisi a più documenti insieme.
- [Revisione tabellare](/funzionalita/revisione-tabellare.md): estrazione di dati da molti documenti in una tabella.

## Organizzazione e automazione

- [Progetti](/funzionalita/progetti.md): raccolte di documenti e conversazioni per organizzare il lavoro.
- [Workflow](/funzionalita/workflow.md): istruzioni e preset salvati e riutilizzabili.

## Principi

- **Citazione prima di tutto**: ogni affermazione normativa rimanda a una [citazione verificabile](/glossario/citazione-verificabile.md).
- **Controllo dell'utente sui dati**: i documenti caricati restano nel suo ambiente (vedi [self-hosting](/glossario/self-hosting.md) e [privacy](/requisiti/privacy-e-dati-personali.md)).
- **Trasparenza**: l'utente vede sempre le fonti su cui si basa una risposta.
