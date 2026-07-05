---
type: Componente
title: Provider LLM (configurabile)
description: Matrice dei provider LLM supportati al lancio, remoti (Anthropic, Google, OpenAI) ed endpoint OpenAI-compatibili, dietro un'unica astrazione, con priorità ai modelli eseguiti in locale.
tags: [llm, provider, locale]
timestamp: 2026-07-05T00:00:00Z
---

# Provider LLM (configurabile)

Almeno un provider a scelta; il provider genera le risposte nel [flusso RAG](./flusso-rag.md).

Poiché la [riservatezza è la leva primaria](../requisiti/privacy-e-dati-personali.md) per gli studi legali, il supporto a **modelli eseguiti in locale** è una priorità: solo così i documenti non lasciano mai la macchina.

La matrice qui sotto definisce i provider supportati al lancio. Poiché l'elenco dei modelli evolve nel tempo, i modelli di default sono scelti e mantenuti attraverso la [valutazione di qualità](../requisiti/valutazione-qualita.md).

## Un'unica astrazione multi-provider

Tutti i provider sono raggiunti dietro un **confine tipizzato** (vedi [confini dietro interfacce](./stack-tecnologico.md)), implementato con il **[Vercel AI SDK](https://sdk.vercel.ai/)**: un'astrazione unica con streaming e tool calling, che parla sia con i provider remoti sia con qualunque endpoint **OpenAI-compatibile**, inclusi i [runtime locali](./runtime-modelli-locali.md).
Cambiare provider o modello (il *model picker* della [gestione delle API key](./gestione-api-key.md)) non tocca la pipeline RAG.

## Provider remoti supportati al lancio

Matrice iniziale: tre provider remoti "di prima classe" più il caso generico OpenAI-compatibile.
Ognuno richiede una [API key](./gestione-api-key.md) dell'utente (nessun abbonamento, nessun lock-in); l'invio a un provider remoto **fa uscire i dati dalla macchina** (vedi cautele sotto).

| Provider | Esempi di modelli | Come raggiunto | Note |
|---|---|---|---|
| **Anthropic** | Claude (famiglia Opus / Sonnet / Haiku) | provider nativo del Vercel AI SDK | Buona resa in italiano e sul ragionamento; adatto ai passi di [pianificazione query](./pianificazione-query.md) e sintesi. |
| **Google** | Gemini (Pro / Flash) | provider nativo | Contesto lungo, utile con molti [chunk](../modello-dati/chunk.md) recuperati. |
| **OpenAI** | GPT (famiglia) | provider nativo | Diffuso; molti studi hanno già una chiave. |
| **Endpoint OpenAI-compatibile** | qualunque modello esposto da un endpoint compatibile | base URL (+ eventuale key) | Copre i gateway remoti (es. OpenRouter) e soprattutto i [runtime self-hosted](./runtime-modelli-locali.md), su `localhost` o sulla rete dello studio, che espongono la stessa API. |

La selezione precisa dei modelli consigliati per default è demandata alla [valutazione di qualità](../requisiti/valutazione-qualita.md) sull'italiano giuridico, così resta misurata e aggiornabile.

## Modelli in locale

I **modelli self-hosted**, che l'utente esegue su un runtime proprio (in locale o su un server controllato dallo studio) e a cui Magistra si collega come client, sono la garanzia di riservatezza più forte e una **priorità di sviluppo**: i dati non vengono affidati a un servizio cloud di terzi (e con un modello sulla stessa macchina non lasciano nemmeno il dispositivo).
I runtime supportati (Ollama, LM Studio, llama.cpp) e il modo in cui Magistra vi si collega sono descritti in [runtime dei modelli locali](./runtime-modelli-locali.md); la scelta del modello, generativo e di [embedding](../glossario/embedding.md), è demandata alla [valutazione di qualità](../requisiti/valutazione-qualita.md), non a una stima.

## Provider remoto: trasparenza e mitigazioni

Quando l'utente sceglie un provider **remoto**, ciò che gli viene inviato esce dalla macchina: questa scelta dev'essere resa **trasparente** e resta una decisione esplicita dell'utente.
Una possibile mitigazione futura è l'[anonimizzazione reversibile](./anonimizzazione-reversibile.md), che sostituirebbe i dati sensibili con segnaposto prima dell'invio e li ripristinerebbe nella risposta; è però **fuori dall'MVP**, dove la privacy nel caso remoto è governata dalla trasparenza e dalla priorità ai modelli locali.

## Degrado controllato

Il provider attivo si sceglie nelle **impostazioni** (vedi [gestione delle API key](./gestione-api-key.md)) e resta fisso per la conversazione: non si cambia provider durante una chat.

Se il provider configurato non è disponibile, l'app deve degradare in modo controllato (messaggio d'errore chiaro, nessuna risposta normativa inventata) senza abbattere l'assistente (requisito di [affidabilità](../requisiti/requisiti-non-funzionali.md)). Il backend **non ripiega in silenzio** su un altro provider: cambiare provider altera privacy, costo e qualità (un modello remoto fa uscire i dati dalla macchina), quindi resta una scelta esplicita dell'utente nelle impostazioni, non una decisione automatica.
