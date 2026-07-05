---
type: Concetto
title: Workflow
description: Istruzioni e preset salvati e riutilizzabili che guidano l'assistente o predefiniscono le colonne di una revisione tabellare.
tags: [workflow, automazione, preset]
timestamp: 2026-07-01T00:00:00Z
---

# Workflow

Un **workflow** è un insieme di istruzioni salvate e riutilizzabili che incapsula un'attività ricorrente, così da non doverla riscrivere ogni volta.

## Tipi

- **Istruzioni per l'[assistente](./assistente-legale.md)**: un [prompt](../glossario/prompt.md) strutturato (es. «verifica la conformità di questo NDA e segnala le clausole mancanti»).
- **Preset per la [revisione tabellare](./revisione-tabellare.md)**: un insieme di colonne/domande predefinite per un certo tipo di documento.

## Caratteristiche

- Sono **riutilizzabili** tra [progetti](./progetti.md) e [conversazioni](../modello-dati/conversazione.md).
- Sono versionabili e modificabili.
- Rappresentano dati applicativi (vedi il [modello applicativo](../modello-dati/modello-applicativo.md)).

## Formato

> Funzionalità di **produttività avanzata**, fuori [MVP](../requisiti/mvp.md) (vedi [Roadmap](../requisiti/roadmap.md)): qui si fissa la direzione del formato; la specifica di dettaglio si scrive quando la feature entra in sviluppo.

### Struttura

Un workflow è un **template parametrizzato a passo singolo**: un corpo riutilizzabile (il [prompt](../glossario/prompt.md) strutturato o l'insieme di colonne per la [revisione tabellare](./revisione-tabellare.md)) con **variabili** compilate al momento del lancio.

Campi previsti:

| Campo | Note |
|---|---|
| `id` | Identificatore stabile. |
| `nome` | Nome leggibile. |
| `descrizione` | A cosa serve. |
| `tipo` | `assistente` (istruzioni) o `revisione-tabellare` (colonne/domande). |
| `parametri` | Elenco di variabili: nome, etichetta, tipo, valore di default, obbligatorietà. |
| `corpo` | Il prompt strutturato o la definizione delle colonne, con segnaposto delle variabili. |
| `versione` | Per tracciare le modifiche nel tempo. |

I passi concatenati (workflow multi-step) restano una possibile **estensione futura**: non necessari per la prima versione della feature, dove il valore sta nel riuso di un'attività ben definita.

### Persistenza e condivisione

I workflow sono **dati applicativi** salvati nel [modello applicativo](../modello-dati/modello-applicativo.md) locale.
Sono **esportabili e importabili** come file *human-readable* (es. JSON), così da poterli riusare su un altro dispositivo o condividere con un collega.
Coerentemente con la natura [single-utente e locale](./progetti.md) del prodotto, la condivisione avviene **per file**, non tramite account condivisi o collaborazione in tempo reale.

### Rapporto con i progetti

Esiste una **libreria personale globale** di workflow, riutilizzabile in tutti i [progetti](./progetti.md) e nelle [conversazioni](../modello-dati/conversazione.md).
Un workflow può inoltre essere **specifico di un progetto**, quando ha senso solo in quel contesto.
