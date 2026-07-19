---
type: Concetto
title: Analisi di documenti
description: Caricamento di contratti, atti e PDF per ottenere riassunti, individuazione di clausole e verifica dei riferimenti normativi citati.
tags: [documenti, analisi, clausole]
timestamp: 2026-07-12T00:00:00Z
---

# Analisi di documenti

L'utente carica un proprio [documento](../modello-dati/documento.md) (contratto, atto, parere, PDF) e l'assistente lo analizza nel contesto del corpus normativo.

## Cosa produce

- **Riassunto** strutturato del documento.
- **Individuazione di clausole** rilevanti o critiche.
- **Verifica dei riferimenti normativi** citati nel documento: l'assistente controlla che gli articoli richiamati esistano e ne riporta il [testo vigente](../glossario/testo-vigente.md), segnalando eventuali [abrogazioni](../glossario/abrogazione.md).
- Risposte a domande mirate sul documento.

## Trattamento del file

- Il file caricato passa per la [conversione documenti](../architettura/conversione-documenti.md), che produce un [Documento strutturato](../modello-dati/documento-strutturato.md) con provenienza verificabile per blocchi e chunk, ed è conservato nell'[archiviazione locale](../architettura/archiviazione-documenti.md).
- L'assistente consuma `document.md`, `document.json` e `chunks.jsonl`: non analizza direttamente il PDF/DOCX e non invoca gli estrattori.
- Resta sulla macchina dell'utente (vedi [privacy](../requisiti/privacy-e-dati-personali.md)).

La gerarchia dei titoli, i confini delle sezioni, le tabelle, l'ordine di lettura e la provenienza aiutano a costruire il riassunto senza perdere il contesto associato alla struttura del documento.
Il chunking coerente e i riferimenti ai blocchi originali riducono omissioni e risposte non supportate, ma non sostituiscono i vincoli di groundedness e verifica delle fonti applicati dall'assistente.

Si appoggia all'[assistente legale](./assistente-legale.md) e può essere svolta su più file insieme con le [operazioni multi-documento](./operazioni-multi-documento.md).
