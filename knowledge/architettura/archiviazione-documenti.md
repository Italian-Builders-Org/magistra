---
type: Componente
title: Archiviazione documenti (locale)
description: Salvataggio dei documenti caricati e degli artefatti derivati sul filesystem locale della macchina.
tags: [storage, documenti, filesystem]
timestamp: 2026-07-12T00:00:00Z
---

# Archiviazione documenti (locale)

Conserva i documenti caricati dall'utente e gli artefatti di [conversione](./conversione-documenti.md)/ingest. Essendo Magistra un'[app desktop locale](./deployment.md), l'archiviazione è il **filesystem locale** della macchina: nessun servizio esterno da avviare e i documenti non lasciano il computer dell'utente.

L'accesso passa da un'interfaccia dedicata, così il componente concreto (oggi il filesystem locale) resta **isolato e sostituibile** senza toccare il resto dell'applicazione. È il [principio dei confini dietro interfacce](./stack-tecnologico.md) applicato allo storage.

## Originali e artefatti derivati

Ogni versione di un [Documento](../modello-dati/documento.md) mantiene separati:

- il file originale immutato;
- l'estrazione fedele prodotta dalla [conversione documenti](./conversione-documenti.md);
- il [Documento strutturato](../modello-dati/documento-strutturato.md), composto da `document.md`, `document.json` e `chunks.jsonl`;
- gli asset estratti e gli eventuali formati convertiti.

Gli artefatti derivati sono rigenerabili e non sovrascrivono l'originale.
L'interfaccia di storage li recupera per documento e versione, così l'[analisi documentale](../funzionalita/analisi-documenti.md) può consumare la rappresentazione pronta per l'AI senza invocare direttamente convertitori o estrattori.
