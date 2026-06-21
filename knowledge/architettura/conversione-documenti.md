---
type: Componente
title: Conversione documenti
description: Estrazione del testo dai file caricati e conversione tra formati (DOC/DOCX ↔ PDF), a supporto di analisi, redazione e revisione.
tags: [documenti, conversione, pdf]
timestamp: 2026-06-20T00:00:00Z
---

# Conversione documenti

Prepara i [documenti](/modello-dati/documento.md) caricati per l'uso da parte dell'assistente: ne estrae il testo e li converte tra formati. La conversione DOC/DOCX → PDF può appoggiarsi a uno strumento locale (es. LibreOffice headless).

## Responsabilità

- **Estrazione del testo** da PDF e formati Office, preservando per quanto possibile la struttura.
- **Conversione di formato** (DOC/DOCX ↔ PDF) per la visualizzazione e per l'esportazione delle bozze redatte.
- Output formattato per casi particolari (es. orientamento orizzontale per checklist/tabelle).

## Relazioni

- Alimenta l'[analisi di documenti](/funzionalita/analisi-documenti.md), la [revisione tabellare](/funzionalita/revisione-tabellare.md) e la [redazione](/funzionalita/redazione-documenti.md).
- I file di origine e i derivati risiedono nell'[object storage](/architettura/object-storage.md).

> Nota: la conversione del **corpus normativo** è cosa diversa: avviene nella [pipeline di trasformazione](/modello-dati/pipeline-trasformazione.md) a partire da [Akoma Ntoso](/glossario/akoma-ntoso.md). Qui si tratta dei documenti **dell'utente**.
