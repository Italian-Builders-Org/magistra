---
type: Componente
title: Provider LLM (configurabile)
description: Matrice dei provider LLM supportati, runtime locale, profili modello e requisiti minimi per la prima release.
tags: [llm, provider, locale, runtime]
timestamp: 2026-07-05T00:00:00Z
---

# Provider LLM (configurabile)

Il provider LLM genera le risposte nel [flusso RAG](./flusso-rag.md). Magistra non lega l'utente a un fornitore: il backend usa un'interfaccia tipizzata e il [Vercel AI SDK](./stack-tecnologico.md) per parlare con provider remoti, endpoint locali e runtime compatibili.

Poiché la [riservatezza è la leva primaria](../requisiti/privacy-e-dati-personali.md) per gli studi legali, il supporto a **modelli eseguiti in locale** è una capacità di prodotto, non un esperimento. Quando l'utente sceglie un provider **remoto**, ciò che viene inviato esce dalla macchina: questa scelta dev'essere resa **trasparente** e può essere mitigata da un'[anonimizzazione reversibile](./anonimizzazione-reversibile.md).

## Decisione MVP

Per la prima release si supportano quattro famiglie di provider:

| Famiglia | Stato MVP | Uso principale | Note |
|---|---|---|---|
| **OpenAI** | Supportato | Generazione remota ed embedding baseline | Provider remoto ad alta qualità; richiede API key utente. |
| **Anthropic Claude** | Supportato | Generazione remota di qualità | Provider remoto; non è provider embedding nel MVP. |
| **Google Gemini** | Supportato | Generazione remota; embedding candidato | Provider remoto; utile come alternativa multi-provider. |
| **Endpoint OpenAI-compatibile** | Supportato | Provider locali o gateway self-hosted | Include **Ollama** come runtime locale principale e altri endpoint compatibili configurati dall'utente. |

Non si introduce un provider proprietario di Magistra e non si fa proxy cloud: l'utente porta le proprie chiavi o usa un runtime locale.

## Runtime locale

Il runtime locale principale per l'MVP è **Ollama**, perché:

- è installabile dagli utenti senza gestire toolchain native;
- espone API locali e compatibilità OpenAI sufficiente per integrarlo dietro lo stesso adapter;
- permette sia chat/generazione sia modelli di embedding locali;
- rende chiaro lo stato operativo del modello (installato, in download, non disponibile).

`llama.cpp` resta un runtime di riferimento per scenari avanzati o integrazioni future: è utile quando servono controllo fine, packaging custom o benchmark, ma non è la UX primaria del MVP.

## Profili modello

I nomi modello non sono hard-coded nella logica di dominio: sono configurazione. La knowledge definisce **profili**, non un lock-in su un model id.

| Profilo | Provider consigliati | Scopo |
|---|---|---|
| `remote-accurato` | OpenAI / Anthropic / Gemini, modello ragionamento o general purpose di fascia alta | Risposte complesse, analisi di documenti, casi ad alto rischio. |
| `remote-rapido` | OpenAI / Anthropic / Gemini, modello veloce/economico | Chat ordinaria, bozze, query brevi, UX reattiva. |
| `locale-standard` | Ollama con modello 7B-8B quantizzato | Uso offline/privacy-first su laptop recente; qualità da validare con eval. |
| `locale-avanzato` | Ollama o runtime compatibile con modello 14B+ quantizzato | Qualità migliore in locale, richiede più RAM/VRAM. |
| `custom-openai-compatible` | Endpoint configurato dall'utente | Gateway aziendale, modello self-hosted o servizio compatibile. |

Per il dominio giuridico italiano, nessun modello viene dichiarato "corretto" senza [valutazione qualità](../requisiti/valutazione-qualita.md). Ogni profilo deve passare casi di groundedness, citazioni, refusal e vigenza prima di diventare raccomandazione predefinita.

## Embedding

L'embedding è distinto dalla generazione. L'[indice normativo](./indice-normativo.md) dichiara nel proprio manifest il modello embedding usato: dimensione, provider, data e versione. Questo evita di mischiare chunk generati con embedding incompatibili.

Decisione iniziale:

- **Baseline remota**: OpenAI `text-embedding-3-large` per qualità/multilingua quando l'utente accetta provider remoto.
- **Profilo economico/remoto**: OpenAI `text-embedding-3-small` o alternativa equivalente del provider scelto, se la qualità resta sopra soglia.
- **Profilo locale/offline**: modello embedding multilingua eseguito via Ollama o runtime compatibile, da confermare con benchmark sul corpus italiano.

Per l'MVP distribuito agli utenti finali l'ingest completo non gira sul dispositivo: il team pubblica un indice già pronto. L'embedding locale serve per prototipi, utenti avanzati o indici personali, non come requisito per usare l'app.

## Requisiti hardware indicativi

Questi valori servono per orientare #27; non sono ancora soglie finali.

| Modalità | Requisito indicativo |
|---|---|
| Provider remoto | CPU moderna, 8 GB RAM; nessuna GPU richiesta. La latenza dipende dal provider e dalla rete. |
| Locale 7B-8B quantizzato | 16 GB RAM consigliati; GPU non obbligatoria ma utile. Su CPU la risposta può essere lenta. |
| Locale 14B quantizzato | 32 GB RAM consigliati; GPU con 12-16 GB VRAM preferibile per UX interattiva. |
| Locale 30B+ | Fuori dal requisito minimo MVP; utile solo per workstation. |

La UI deve mostrare chiaramente quando un profilo locale rischia di essere troppo pesante per la macchina dell'utente.

## Regole di privacy e fallback

- Default privacy-first: se un runtime locale è disponibile e validato, l'utente può scegliere che nessun contenuto lasci la macchina.
- Provider remoto: la UI deve segnalare che domanda, contesto e documenti inviati lasciano il dispositivo.
- Se il provider remoto è usato su testi sensibili, l'app deve offrire il layer di [anonimizzazione reversibile](./anonimizzazione-reversibile.md) quando disponibile.
- Se il provider fallisce, il backend deve degradare in modo controllato: errore chiaro, possibilità di cambiare profilo, nessuna risposta normativa inventata.
- Il modello può aiutare a scrivere, ma non può sostituire retrieval, citazioni verificabili e controlli di vigenza.
