---
type: Concetto
title: Identificazione — URI ELI
description: L'ELI o identificatore normalizzato del Work logico per collegare versioni, citazioni e riferimenti incrociati.
resource: https://eur-lex.europa.eu/eli-register/about.html
tags: [eli, identificazione, chiave-primaria]
timestamp: 2026-06-25T00:00:00Z
---

# Identificazione: URI ELI

Ogni norma è ricondotta a un **Work logico** identificato da una URI [ELI](../glossario/eli.md) (European Legislation Identifier) o da un identificatore normalizzato derivato dagli URI della fonte. Magistra usa questo identificatore per collegare versioni, citazioni e riferimenti incrociati.

Nel profilo italiano ELI usato da Normattiva, gli URI `ORIGINAL` e `CONSOLIDATED` possono essere distinti per la stessa norma. Magistra non li assume quindi come unica chiave immutabile tra versioni, ma li normalizza rispetto al Work logico.

Esempio di pattern ELI nell'implementazione italiana (Normattiva), che usa `stato` come giurisdizione, senza codice paese:

```
/eli/stato/legge/1990/08/07/241/...
```

Vantaggi: interoperabilità europea, collegamenti verificabili e deduplicazione controllata.
