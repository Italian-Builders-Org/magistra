---
type: Bundle di Conoscenza
title: Knowledge base Magistra
version: 0.1.0
description: Bundle OKF (Open Knowledge Format v0.1) che raccoglie fonti dati, modello dati, architettura e glossario del progetto.
resource: https://github.com/Italian-Builders-Org/Italian-OSS-Legal-Platform
tags: [okf, knowledge-base, diritto-italiano]
timestamp: 2026-06-18T00:00:00Z
---

# Knowledge base: Magistra

Questa cartella è un **bundle [Open Knowledge Format (OKF) v0.1](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)**: una directory di file Markdown con frontmatter YAML, leggibile da persone e agenti AI senza alcun SDK o piattaforma proprietaria.

## Convenzioni del bundle

- **Un file = un concetto**. Ogni documento descrive una singola entità (una fonte, un'entità dati, un componente, un termine).
- **Frontmatter YAML** in testa a ogni file. L'unico campo obbligatorio è `type`; `title`, `description`, `resource`, `tags`, `timestamp` sono opzionali.
- **`index.md`** in ogni cartella descrive e indicizza i concetti contenuti.
- **Collegamenti** tra concetti con percorsi relativi alla radice del bundle, es. `[Norma](/modello-dati/norma.md)`.

## Aree

- [Fonti dei dati](/fonti/index.md): fonti normative aperte, formati e condizioni di riuso.
- [Modello dati](/modello-dati/index.md): FRBR, ELI, struttura Akoma Ntoso, entità del corpus e dell'applicazione.
- [Architettura](/architettura/index.md): componenti del sistema, flusso RAG e pipeline di trasformazione.
- [Funzionalità](/funzionalita/index.md): cosa fa la piattaforma per l'utente (assistente, ricerca, documenti, workflow).
- [Requisiti e qualità](/requisiti/index.md): ambito MVP, roadmap, privacy, sicurezza, licenze e valutazione delle risposte.
- [Glossario](/glossario/index.md): termini giuridici e tecnici.
