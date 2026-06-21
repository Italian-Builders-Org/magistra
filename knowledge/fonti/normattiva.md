---
type: Fonte Dati
title: Normattiva: Open Data
description: Fonte primaria per la legislazione statale italiana (leggi, decreti, codici), in formato Akoma Ntoso / ELI.
resource: https://dati.normattiva.it/
tags: [fonte-primaria, normattiva, akoma-ntoso, eli]
timestamp: 2026-06-18T00:00:00Z
---

# Normattiva: Open Data (fonte primaria)

Portale: <https://dati.normattiva.it/>

La fonte principale per la legislazione statale italiana (leggi, decreti legge, decreti legislativi, regi decreti, codici). Realizzato dall'Istituto Poligrafico e Zecca dello Stato su iniziativa del comitato di gestione Normattiva.

## Formati disponibili

| Formato | Descrizione | Uso in Magistra |
|---|---|---|
| **[Akoma Ntoso (LegalDOCML)](/glossario/akoma-ntoso.md)** | XML giuridico strutturato, standard OASIS | Fonte canonica per il parsing |
| **[XML NIR](/glossario/xml-nir.md)** (NormeInRete) | Standard XML AgID precedente | Fallback / atti storici |
| **JSON** | Rappresentazione strutturata | Ingest rapido / metadati |
| **HTML** | Testo formattato | Anteprima / debug |
| **[URI ELI](/glossario/eli.md)** | Identificatori permanenti (European Legislation Identifier) | Chiave stabile di riferimento |

## Esportazioni temporali

- **Versione originaria**: testo come pubblicato in origine.
- **Vigente a una data**: testo in vigore a una data specifica.
- **Multivigente**: tutte le versioni nel tempo (fondamentale per il confronto storico). Vedi [multivigenza](/glossario/multivigenza.md).
