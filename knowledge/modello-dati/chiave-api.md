---
type: Entità Dati
title: Chiave API
description: Credenziale di un provider LLM configurata in locale, conservata cifrata.
tags: [entita, api-key, cifratura]
timestamp: 2026-07-05T00:00:00Z
---

# Chiave API

La credenziale con cui la piattaforma interroga un [provider LLM](../architettura/provider-llm.md) per conto dell'utente. Gestita dal componente [gestione delle API key](../architettura/gestione-api-key.md).

| Campo | Descrizione |
|---|---|
| `id` | identificativo (chiave primaria) |
| `provider` | Anthropic, Google, OpenAI, endpoint locale, … |
| `valore_cifrato` | la chiave, conservata [cifrata](../glossario/cifratura.md) (mai in chiaro) |
| `configurazione` | metadati non segreti: base URL, modello predefinito, profilo |
| `creata_il` | data di inserimento |
| `aggiornata_il` | data dell'ultima modifica |

## Note di sicurezza

- Il valore non compare mai in chiaro nel database né nei log (requisito di [sicurezza](../requisiti/sicurezza.md)).
- Le chiavi restano sulla macchina locale dell'utente (single-utente).
- Non esiste FK verso un utente: la configurazione appartiene all'istanza locale.

Parte del [modello dati applicativo](./modello-applicativo.md).
