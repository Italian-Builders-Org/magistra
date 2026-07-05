---
type: Concetto
title: Stack tecnologico
description: Scelta di uno stack TypeScript-first end-to-end per Magistra, con le librerie e il runtime di base, i componenti non-TS e i criteri per l'escape hatch.
tags: [stack, typescript, oss, architettura]
timestamp: 2026-07-01T00:00:00Z
---

# Stack tecnologico

Magistra adotta uno **stack applicativo TypeScript-first**: lo stesso linguaggio per il [frontend](./frontend.md), il [backend / API](./backend-api.md), il [worker di ingest](./worker-ingest.md), il tooling e l'app desktop.

> Le scelte di stack, librerie e runtime qui sotto sono stabili — non un vincolo ideologico, ma la base tecnica su cui costruire. Solo i dettagli implementativi più fini restano per il documento di design; l'applicativo è una desktop app basata su **Electron**.

## Perché TypeScript-first

Il prodotto richiede oggi soprattutto retrieval, orchestrazione, indicizzazione, chat, integrazioni, frontend e distribuzione desktop: nessuna di queste aree impone un altro runtime.
La scelta è guidata dalla natura **open source** del progetto:

- **Accessibilità per la community**: TypeScript/JavaScript è familiare a una platea molto ampia di contributor, il che abbassa la barriera d'ingresso per chi vuole contribuire a UI, API, worker e tooling.
- **Onboarding più semplice**: un solo linguaggio significa meno contesto mentale, meno stack da mantenere e maggiore coerenza tra i componenti.
- **Codice e tipi condivisi**: i contratti dei dati possono essere condivisi tra frontend, backend e app desktop.
- **App desktop**: uno stack JS facilita la distribuzione come [app desktop](./deployment.md), dove l'intero bundle — UI, dati e logica — viene impacchettato insieme con **Electron**, che mantiene tutto in TypeScript.

## Librerie e runtime di base

Scelte di base confermate per l'MVP, coerenti con i principi qui descritti (default TypeScript, confini netti, reversibilità).

| Ambito | Scelta | Motivazione |
|---|---|---|
| Runtime | **Node.js**, linea Active LTS | All'interno dell'app desktop il runtime è **Node** (incluso in Electron), quindi non si fissa una minor version isolata: si segue la linea LTS supportata da Electron. Per il tooling e per il [worker](./worker-ingest.md) standalone vale comunque l'Active LTS. |
| Comunicazione UI ↔ backend | **IPC** di Electron | App desktop locale e single-utente: nessun server HTTP, nessuna porta aperta su `localhost`. Vedi [backend / API](./backend-api.md). |
| Contratti e validazione | **TypeScript condiviso + Zod** | Tipi condivisi tra UI, backend e worker; Zod valida a runtime i confini (messaggi IPC, input dell'utente, dati esterni) senza duplicare gli schemi. |
| Integrazione LLM | **Vercel AI SDK** | Astrazione unica multi-provider con streaming e tool calling; supporta endpoint locali OpenAI-compatibili, coerente con un [provider configurabile](./provider-llm.md) e con la priorità ai **modelli locali**. |
| Orchestrazione RAG | **Pipeline interna a Magistra** | Il [flusso RAG agentico](./flusso-rag.md) (pianificazione query, reranking, fallback solo da fonti supportate, citazioni verificabili) è specifico del dominio: la pipeline è codice nostro, senza framework di orchestrazione come dipendenza core, per controllarne ogni passo e non ereditarne astrazioni e churn. |
| Database applicativo | **PGlite (Postgres in WASM)** | Motore relazionale embedded per i dati dell'app: piccoli dati transazionali, zero dipendenze native. Vedi [database applicativo](./database-applicativo.md). |
| Indice del corpus | **LanceDB** (motore vettoriale embedded nativo) | Disk-based e con prefiltro nativo per metadato: scala il corpus normativo oltre i limiti di `pgvector` in WASM. Vedi [indice normativo](./indice-normativo.md). |
| Build frontend | **Vite** | Build tool del renderer React: bundle statico, dev server con HMR, nessun runtime server lato frontend (la UI parla col backend via IPC). Vedi [frontend](./frontend.md). |
| Packaging desktop | **electron-builder + electron-updater** | Genera gli installer per OS, gestisce firma cross-platform e auto-update con un'unica configurazione; impacchetta il renderer già buildato con Vite. Vedi [packaging e distribuzione](./packaging-distribuzione.md). |

## Confini dietro interfacce

I componenti che dipendono da un'implementazione concreta — accesso ai [dati](./database-applicativo.md) e all'[indice](./indice-normativo.md), [archiviazione documenti](./archiviazione-documenti.md), [provider LLM](./provider-llm.md), trasporto tra UI e [backend](./backend-api.md) — sono raggiunti **dietro un'interfaccia tipizzata**, mai con accoppiamento diretto all'implementazione.
Il vantaggio è tutto interno al progetto:

- **Testabilità**: la logica si esercita con implementazioni di prova, senza avviare il componente reale.
- **Modularità e reversibilità**: l'implementazione concreta (oggi PGlite embedded, filesystem locale, IPC di Electron) resta **isolata e sostituibile** senza riscrivere la logica di dominio.
- **Portabilità**: la stessa logica non dipende da *dove* gira né da *come* è raggiunta.

È lo stesso principio già applicato all'[archiviazione documenti](./archiviazione-documenti.md) e al [provider LLM intercambiabile](./provider-llm.md).

## Componenti non-TS e relativi confini

Lo stack è TypeScript-first ma non "puro": alcuni componenti non sono TypeScript, ciascuno isolato dietro un **confine netto**.

- **PGlite** — Postgres compilato a **WASM**: motore del [database applicativo](./database-applicativo.md). Confine: si usa via la sua interfaccia SQL/driver, come una libreria.
- **LanceDB** — motore vettoriale **embedded nativo** (Rust, binari precompilati cross-platform) per l'[indice del corpus](./indice-normativo.md). Confine: in-process, dietro l'interfaccia dell'indice, impacchettato nel bundle. È l'escape hatch applicato a un requisito concreto e dimostrato (la scala dell'indice, vedi i criteri qui sotto).
- **LibreOffice headless** — usato per la [conversione documenti](./conversione-documenti.md): sottoprocesso esterno invocato come job. Confine: processo separato con input/output su file.
- **Runtime dei modelli locali**. Gli LLM e i modelli di embedding self-hosted (Ollama, LM Studio, `llama.cpp`) **non** sono impacchettati né eseguiti da Magistra: è l'utente ad avviarli. Confine: servizio esterno raggiunto come endpoint OpenAI-compatibile dietro l'interfaccia del [provider configurabile](./provider-llm.md), senza alcun motore nativo nel bundle. Vedi [runtime dei modelli locali](./runtime-modelli-locali.md).

## Escape hatch: criteri

Il default è TypeScript, ma la scelta del linguaggio resta **reversibile**: conta di più documentare bene i confini tra API, retrieval e ingest che imporre un unico runtime per comodità.
Se emerge un requisito **concreto** che rende un altro runtime o una libreria non-TS nettamente più adatti per un componente specifico, quel componente si introduce **solo quando sono soddisfatti tutti** questi criteri:

1. **Requisito concreto e dimostrato** — esiste un'esigenza reale (prestazioni, correttezza, una libreria insostituibile) verificata da un caso o da un benchmark, non ipotetica.
2. **Confine netto e contratto stabile** — il componente è isolato dietro un'interfaccia con input/output **tipizzati e versionati** (processo separato, IPC, scambio su file), così il resto resta TypeScript.
3. **Reversibilità** — si può sostituire o rimuovere il componente senza riscrivere l'applicazione: non contamina il resto del codebase.
4. **Packaging cross-platform** — si impacchetta e distribuisce nell'[app desktop](./deployment.md) su tutte le piattaforme target senza degradare l'installazione.
5. **Licenza compatibile** con la natura open source del progetto.
6. **Costo di manutenzione sostenibile** per una community prevalentemente TS/JS (toolchain, build, onboarding dei contributor).

Esempio già in atto: l'adozione di **LanceDB** per l'[indice del corpus](./indice-normativo.md) soddisfa questi criteri — requisito di scala dimostrato dal benchmark di @MiPnamic, confine netto dietro l'interfaccia dell'indice, binari precompilati cross-platform, licenza compatibile e motore sostituibile.

## Cosa NON dipende dal linguaggio

La separazione architetturale tra API in tempo reale e job batch (vedi [worker di ingest](./worker-ingest.md)) è indipendente dalla scelta del linguaggio: vale a prescindere dal runtime adottato.
Allo stesso modo, l'**igiene delle dipendenze** è una disciplina trasversale e non una proprietà del linguaggio: i registri di pacchetti (npm come PyPI) condividono la stessa classe di rischi di supply-chain (typosquatting, script di installazione malevoli). Vedi [sicurezza](../requisiti/sicurezza.md).

## Componenti e relativo linguaggio

- [Frontend](./frontend.md): TypeScript / React (Vite); componenti UI in una libreria separata e portabile.
- [Backend / API](./backend-api.md): TypeScript / Node, esposto via IPC (non un server HTTP).
- [Worker di ingest](./worker-ingest.md): TypeScript / Node, processo separato dal backend.
- [Database applicativo](./database-applicativo.md): PGlite embedded (Postgres in WASM).
- [Indice normativo](./indice-normativo.md): LanceDB, motore vettoriale embedded nativo.
- App desktop: Electron, interamente in TypeScript.
