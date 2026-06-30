---
type: Processo
title: Deployment
description: Magistra è distribuita come app desktop installabile che gira interamente in locale, senza Docker né competenze sistemistiche.
tags: [deployment, desktop, locale]
timestamp: 2026-06-30T00:00:00Z
---

# Deployment

Magistra è distribuita come **app desktop installabile**, non come stack di servizi. Il target è l'avvocato, che non deve installare Docker né gestire infrastruttura: scarica l'app e la usa.

> L'approccio di distribuzione qui descritto è stabile: app desktop installabile, tutto in locale. I dettagli di packaging — framework desktop, modo di impacchettare il frontend, formati per OS, firma e auto-update — sono definiti in [packaging e distribuzione](./packaging-distribuzione.md).

## App desktop

- È un **bundle che contiene tutto**: UI, logica di business e dati. Non un semplice client.
- Il [database applicativo](./database-applicativo.md) è un'istanza **embedded** PGlite (Postgres in WASM) e l'[indice normativo](./indice-normativo.md) usa **LanceDB** (motore vettoriale embedded nativo): entrambi nel bundle. I documenti dell'utente vanno sul **filesystem locale** (vedi [archiviazione locale](./archiviazione-documenti.md)).
- I dati restano sulla macchina dell'utente, senza il costo tecnico di gestire server o servizi.
- L'app desktop è basata su **Electron**, coerente con lo [stack TypeScript-first](./stack-tecnologico.md) (l'intero bundle resta in TS).

## Indice già pronto

L'[ingest del corpus](../modello-dati/pipeline-trasformazione.md) non viene eseguito sul dispositivo di ogni utente: è il team a svolgerlo in un **ambiente controllato** e a distribuire un **indice già "ingestato"**. L'indice pre-costruito è incluso nel bundle (o scaricato al primo avvio) e può essere **aggiornato**; l'utente "pro" resta libero di rieseguire l'ingest da sé, perché la relativa logica vive nel repository.

## Configurazione

- Chiavi di [cifratura](../glossario/cifratura.md) dei segreti (vedi [sicurezza](../requisiti/sicurezza.md)).
- [API key](./gestione-api-key.md) dei [provider LLM](./provider-llm.md).

I segreti non sono versionati. Lo schema del database evolve con migrazioni versionate.
