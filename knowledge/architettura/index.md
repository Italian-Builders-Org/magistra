---
type: Indice
title: Architettura
description: Componenti del sistema e flusso RAG. Bozza per orientare le scelte; non è ancora un'implementazione.
tags: [architettura, rag, self-hosting]
timestamp: 2026-06-18T00:00:00Z
---

# Architettura

Bozza di architettura per Magistra. In questa fase serve a orientare le scelte; non è ancora un'implementazione.

## Vista d'insieme

```mermaid
flowchart TD
    Utente(["Utente"])
    FE["Frontend (Next.js)"]
    BE["Backend / API (Node)<br/>orchestrazione RAG"]
    VDB[("Vector DB<br/>PostgreSQL + pgvector")]
    OS[("Object storage<br/>MinIO, S3-compat.<br/>documenti utente")]
    IDX["Indice normativo<br/>chunk + metadati ELI"]
    Pipe[/"Pipeline di ingest"/]
    LLM["LLM<br/>provider configurabile"]

    Utente --> FE
    FE -->|API| BE
    BE --> VDB
    BE --> OS
    VDB --> IDX
    Pipe -. alimenta .-> IDX
    BE --> LLM
    LLM -->|risposte con citazioni| FE
```

## Concetti

- [Frontend (Next.js)](/architettura/frontend.md)
- [Backend / API (Node)](/architettura/backend-api.md)
- [Indice normativo + Vector DB](/architettura/indice-normativo.md)
- [Database applicativo](/architettura/database-applicativo.md)
- [Object storage (S3-compatibile)](/architettura/object-storage.md)
- [Provider LLM (configurabile)](/architettura/provider-llm.md)
- [Gestione delle API key](/architettura/gestione-api-key.md)
- [Conversione documenti](/architettura/conversione-documenti.md)
- [Pianificazione delle query](/architettura/pianificazione-query.md)
- [Flusso di una domanda (RAG agentico)](/architettura/flusso-rag.md)
- [Deployment e self-hosting](/architettura/deployment.md)
- [Pipeline di trasformazione (v0.1)](/architettura/pipeline/index.md): data plane, fasi, gate e [contratto retrieval](/architettura/pipeline/contratto-retrieval-api.md)

## Principi architetturali

- **Citazione prima di tutto**: nessuna risposta normativa senza fonte recuperata dall'indice.
- **Single-utente**: questa versione OSS è pensata per una sola persona su un proprio computer/server; non gestisce account, login né multi-utenza (quelli sono previsti solo per la futura versione cloud gestita).
- **Separazione dati/modello**: la qualità dipende dai dati e dal retrieval, non solo dall'LLM.
- **Self-hosting possibile**: l'architettura deve poter girare interamente sotto il controllo dell'utente.
- **Modularità**: provider LLM, storage e database intercambiabili.
