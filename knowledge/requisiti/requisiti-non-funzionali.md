---
type: Concetto
title: Requisiti non funzionali
description: Vincoli di prestazioni, scalabilità, affidabilità, usabilità e portabilità che il sistema deve rispettare a prescindere dalle singole funzionalità.
tags: [requisiti, prestazioni, affidabilita]
timestamp: 2026-06-30T00:00:00Z
---

# Requisiti non funzionali

Vincoli trasversali che valgono per tutte le [funzionalità](../funzionalita/index.md).

> Bozza concettuale: le soglie numeriche sono indicative, da fissare nelle specifiche.

| Categoria | Requisito (proposta) |
|---|---|
| **Prestazioni** | Risposta dell'[assistente](../funzionalita/assistente-legale.md) percepita come interattiva; risultati di [ricerca](../funzionalita/ricerca-normativa.md) in tempi brevi. Streaming della risposta token-per-token. |
| **Scalabilità** | L'[indice normativo](../architettura/indice-normativo.md) deve reggere l'intero corpus statale; le [operazioni multi-documento](../funzionalita/operazioni-multi-documento.md) un numero ragionevole di file per lotto (tetto iniziale provvisorio ~50, elastico sulle risorse locali). Lotti grandi: coda su [worker separato](../architettura/worker-ingest.md), avanzamento, risultati parziali e ripresa, esecuzione sequenziale o a concorrenza limitata per non bloccare l'assistente. La soglia esatta dipende dai target hardware. |
| **Affidabilità** | Nessuna risposta normativa senza fonte; degrado controllato se un [provider LLM](../architettura/provider-llm.md) non è disponibile. Il [calcolo di pene e termini](../funzionalita/calcolo-pena-termini.md) dev'essere **esatto e regolato**, non generato dall'LLM. Il batch normativo gira su un [worker separato](../architettura/worker-ingest.md): un re-ingest o un [AKN](../glossario/akoma-ntoso.md) rotto non deve abbattere l'assistente. |
| **Portabilità** | Deve girare interamente come [app desktop](../architettura/deployment.md) locale, con tutto impacchettato nel bundle; il [provider LLM](../architettura/provider-llm.md) resta intercambiabile. **Windows** è la piattaforma primaria dei primi studi tester, accanto a macOS/Linux. |
| **Usabilità** | Interfaccia in italiano; citazioni sempre raggiungibili in un clic; trasparenza sulle fonti usate. |
| **Osservabilità** | Tracciabilità di quali [chunk](../modello-dati/chunk.md) hanno prodotto una risposta, a supporto della [valutazione della qualità](./valutazione-qualita.md). |
| **Costi** | Uso della [API key](../architettura/gestione-api-key.md) dell'utente; nessun lock-in su un fornitore. |

Sicurezza e privacy hanno documenti dedicati: [Sicurezza](./sicurezza.md) e [Privacy e dati personali](./privacy-e-dati-personali.md).
