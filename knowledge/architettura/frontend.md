---
type: Componente
title: Frontend (Next.js)
description: Interfaccia di chat, ricerca e visualizzazione documenti con citazioni cliccabili verso la fonte.
tags: [frontend, nextjs, typescript]
timestamp: 2026-06-30T00:00:00Z
---

# Frontend (Next.js / TypeScript)

Interfaccia di chat, ricerca, caricamento e visualizzazione documenti con [citazioni](../glossario/citazione-verificabile.md) cliccabili che rimandano alla fonte ([ELI](../glossario/eli.md) / [Normattiva](../fonti/normattiva.md)).

## Packaging

Nel bundle desktop il frontend è impacchettato come **export statico** di Next.js (`output: 'export'`), caricato nel renderer di Electron tramite un protocollo applicativo locale, senza server HTTP né porte aperte.
Non si usano SSR né API route: ogni operazione passa per l'[IPC verso il backend](./backend-api.md). Vedi [packaging e distribuzione](./packaging-distribuzione.md).
