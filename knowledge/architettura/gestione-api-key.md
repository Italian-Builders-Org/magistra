---
type: Componente
title: Gestione delle API key
description: Configurazione locale di provider LLM, endpoint OpenAI-compatibili e segreti, con conservazione cifrata e nessun lock-in.
tags: [api-key, cifratura, provider-llm]
timestamp: 2026-07-05T00:00:00Z
---

# Gestione delle API key

Permette di configurare in locale le credenziali e gli endpoint per i [provider LLM](./provider-llm.md): nessun abbonamento Magistra e nessun lock-in, l'utente porta la propria chiave o usa un runtime locale.

## Responsabilità

- Inserimento, aggiornamento e rimozione delle [chiavi API](../modello-dati/chiave-api.md).
- Configurazione di endpoint OpenAI-compatibili locali o self-hosted, anche senza API key.
- **Conservazione [cifrata](../glossario/cifratura.md)** a riposo: mai in chiaro nel database né nei log (requisito di [sicurezza](../requisiti/sicurezza.md)).
- Selezione del profilo modello attivo: generazione, embedding, fallback.
- Test connessione e recupero opzionale della lista modelli disponibili.
- Le chiavi restano sulla macchina locale dell'utente (single-utente).

## Provider iniziali

| Provider | Tipo segreto | Campi minimi | Note |
|---|---|---|---|
| OpenAI-compatible gateway | API key | `base_url`, `api_key`, modello generazione, eventuale modello embedding | Default MVP remoto. Preset: OpenRouter e Vercel AI Gateway. |
| Provider diretto | API key | provider, `api_key`, modello generazione, eventuale modello embedding | Preset per OpenAI, Anthropic e Google Gemini quando servono chiavi native o feature specifiche. |
| llama.cpp locale | Nessuna chiave di default | `base_url`, modello generazione, eventuale modello embedding | Runtime locale primario; default tipico `http://127.0.0.1:8080` se avviato con `llama-server`. |
| Ollama locale | Nessuna chiave di default | `base_url`, modello generazione, eventuale modello embedding | Runtime esterno supportato se già installato; default tipico `http://127.0.0.1:11434`. |
| OpenAI-compatible custom | API key opzionale | `base_url`, `api_key` opzionale, modelli | Gateway aziendale, runtime self-hosted o servizio compatibile. |

I nomi modello sono configurazione, non costanti del codice. La UI può proporre preset, ma deve permettere override manuale.

## Separazione tra segreti e configurazione

Non tutto è segreto:

- **Segreti**: API key, token, eventuali header di autenticazione.
- **Configurazione non segreta**: provider, `base_url`, model id, profilo attivo, preferenze di streaming, timeout, cost cap, modalità privacy.

I segreti vanno cifrati e mascherati in UI/log. La configurazione non segreta può essere salvata nel database applicativo per ricostruire il profilo attivo, ma non deve contenere token.

## Test e fallback

Ogni profilo provider deve avere:

- test connessione esplicito prima dell'uso;
- timeout configurabile;
- messaggio d'errore comprensibile;
- fallback manuale verso un altro profilo;
- stato visibile in UI: configurato, non configurato, non raggiungibile, modello mancante.

Se un provider fallisce durante una risposta, il backend non deve completare "a memoria" con un altro modello senza consenso dell'utente: il cambio di provider può alterare privacy, costi e qualità.

## Relazioni

- Le chiavi sono usate dal [backend](./backend-api.md) al momento di interrogare l'LLM nel [flusso RAG](./flusso-rag.md).
- Modellate dall'entità [Chiave API](../modello-dati/chiave-api.md).
- Algoritmi, keychain e ciclo di vita delle chiavi sono definiti in [sicurezza](../requisiti/sicurezza.md) e nella issue dedicata alla cifratura.
