---
type: Entità Dati
title: Norma (Work)
description: Entità che rappresenta la norma in astratto, indipendente dalle versioni; mappa il livello Work di FRBR.
tags: [entita, work, eli]
timestamp: 2026-07-05T00:00:00Z
---

# Norma (Work)

Astratta dai formati di origine, indipendente dal database scelto. Corrisponde al livello **Work** del [modello FRBR](./frbr.md).

| Campo | Descrizione |
|---|---|
| `eli` | URI [ELI](../glossario/eli.md) del Work, **chiave primaria** |
| `tipo_atto` | legge, decreto legge, d.lgs., codice, … |
| `numero` | numero dell'atto, se presente |
| `data_atto` | data dell'atto |
| `titolo` | titolo / oggetto |
| `fonte` | provenienza primaria, es. [Normattiva](../fonti/normattiva.md) |
| `creata_il` | data di prima acquisizione nel corpus Magistra |
| `aggiornata_il` | data dell'ultimo refresh dei metadati |

## Relazioni e vincoli

- Una Norma ha una o più [Versioni](./versione.md).
- `eli` è stabile e non dipende dalla singola versione temporale.
- Non si duplica il testo della norma: il testo vive nelle [Unità](./unita.md) delle singole versioni.
