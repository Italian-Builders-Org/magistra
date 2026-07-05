---
type: Componente
title: Gestione delle API key
description: Configurazione in locale di chiavi ed endpoint dei provider LLM, con separazione tra segreti cifrati e configurazione non segreta, senza lock-in.
tags: [api-key, cifratura, provider-llm]
timestamp: 2026-07-05T00:00:00Z
---

# Gestione delle API key

Permette di configurare in locale le chiavi per i [provider LLM](./provider-llm.md): nessun abbonamento e nessun lock-in, l'utente porta la propria chiave.

## Responsabilità

- Inserimento e aggiornamento delle [chiavi API](../modello-dati/chiave-api.md) per i provider remoti (Anthropic, Google, OpenAI) e per gli endpoint [self-hosted](./runtime-modelli-locali.md): un servizio su `localhost` di norma non richiede chiave, mentre un server raggiunto sulla rete dello studio richiede spesso un'autenticazione, quindi la chiave è **opzionale** a seconda del setup.
- **Conservazione [cifrata](../glossario/cifratura.md)** a riposo: mai in chiaro nel database né nei log (requisito di [sicurezza](../requisiti/sicurezza.md)).
- Selezione del modello attivo (model picker).
- Test della connessione al provider prima dell'uso, con stato visibile in UI (configurato, non raggiungibile, modello mancante).
- Le chiavi restano sulla macchina locale dell'utente (single-utente).

## Segreti e configurazione

Non tutto ciò che descrive un provider è un segreto, e la distinzione guida dove salvare cosa.

- **Segreti**: le [chiavi API](../modello-dati/chiave-api.md), i token, gli eventuali header di autenticazione. Vanno [cifrati](../glossario/cifratura.md) a riposo e mascherati in UI e nei log.
- **Configurazione non segreta**: il provider scelto, la `base_url` di un [endpoint locale o compatibile](./provider-llm.md), l'id del modello attivo, i timeout, la modalità privacy. Può risiedere nel [database applicativo](./database-applicativo.md), ma non deve mai contenere token.

## Relazioni

- Le chiavi sono usate dal [backend](./backend-api.md) al momento di interrogare l'LLM nel [flusso RAG](./flusso-rag.md).
- Modellate dall'entità [Chiave API](../modello-dati/chiave-api.md).
