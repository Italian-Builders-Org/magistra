---
type: Componente
title: Anonimizzazione reversibile dei dati sensibili
description: Mitigazione futura (fuori dall'MVP) che, con un provider LLM remoto, sostituirebbe i dati sensibili con segnaposto prima dell'invio e li ripristinerebbe nella risposta, tenendo la mappatura solo in locale.
tags: [privacy, anonimizzazione, llm]
timestamp: 2026-07-05T00:00:00Z
---

# Anonimizzazione reversibile dei dati sensibili

Ipotesi di un layer che riduce il rischio quando l'utente sceglie un [provider LLM](./provider-llm.md) **remoto**: poiché in quel caso ciò che viene inviato lascia la macchina (vedi [riservatezza come leva primaria](../requisiti/privacy-e-dati-personali.md)), il layer **rimuove o trasforma i dati sensibili prima dell'invio** e li **ripristina** dopo l'interazione con il modello.

## Decisione: fuori dall'MVP

Il layer **non entra nell'MVP**; resta documentato qui come mitigazione da valutare in una versione successiva.
La decisione discende da tre ragioni, tutte già fissate altrove nell'architettura:

- **È una mitigazione opzionale e imperfetta, non la garanzia principale.** La risposta forte alla riservatezza sono i [modelli eseguiti in locale](./provider-llm.md), dove nessun dato lascia la macchina; l'anonimizzazione serve solo al caso "provider remoto", che è la strada già sconsigliata. Per costruzione ha **falsi negativi** e può **degradare la qualità** della risposta: non è una barriera su cui fondare la promessa di privacy.
- **Gli strumenti maturi non superano l'escape hatch.** Presidio e LLM Guard sono in Python e richiedono modelli NER (spaCy); impacchettare un **runtime Python** dentro l'[app desktop Electron](./stack-tecnologico.md) su tutte le piattaforme non soddisfa i criteri dell'escape hatch (packaging cross-platform senza degradare l'installazione, costo di manutenzione sostenibile per una community TS/JS) a fronte di un beneficio solo parziale. Le librerie JS/TS equivalenti sono meno mature sull'italiano e sul lessico legale.
- **L'MVP copre già il caso remoto in modo trasparente.** Quando l'utente sceglie un provider remoto, l'app rende **esplicita** la scelta (vedi [trasparenza e mitigazioni](./provider-llm.md)) e non ripiega mai in silenzio su un provider che fa uscire i dati: la privacy è governata dalla scelta consapevole dell'utente e dalla priorità ai modelli locali, non da un filtro automatico imperfetto.

Quanto segue non fa parte del contratto della prima implementazione: è un'appendice tecnica per una versione successiva, subordinata alla decisione già chiusa di tenere il layer fuori dall'MVP.

## Come funzionerebbe (anonimizza → elabora → de-anonimizza)

1. **Rilevamento** (locale): individua le entità sensibili (nomi di assistiti e controparti, codice fiscale, partita IVA, indirizzi, ecc.) con NER + espressioni regolari + regole di contesto.
2. **Pseudonimizzazione** (locale): sostituisce ogni entità con un **segnaposto** stabile; la mappatura segnaposto ↔ valore originale è conservata in un **vault locale** [cifrato](../glossario/cifratura.md) che non lascia mai la macchina.
3. **Invio**: al provider remoto va **solo il testo anonimizzato**.
4. **Ripristino** (locale): nella risposta del modello i segnaposto vengono risostituiti con i valori originali tramite il vault.

Tutto ciò che è sensibile, insieme alla mappatura, resterebbe in locale; al provider arriverebbe solo testo anonimizzato.

## Vincoli per una versione successiva

Se il layer verrà introdotto in una versione successiva, dovrà rispettare questi vincoli di design:

- **Strumento e confine.** Rivalutare, alla luce dello stato dell'arte del momento, tra una **libreria JS/TS** di pseudonimizzazione (resta nello [stack](./stack-tecnologico.md), ma oggi meno matura sull'italiano legale) e **Microsoft Presidio / LLM Guard** come **sottoprocesso o servizio Python locale** dietro un confine netto (come già fa la [conversione documenti](./conversione-documenti.md) con LibreOffice). La scelta va misurata contro i criteri dell'escape hatch, non assunta a priori.
- **Set di entità del dominio legale italiano.** Oltre alle PII generiche, servono i *recognizer* specifici: **codice fiscale**, **partita IVA**, **estremi di causa** (numero di ruolo, R.G.), nomi di assistiti e controparti. La copertura va tarata e verificata sull'italiano, non stimata.
- **Revisione dell'utente prima dell'invio.** Poiché il rilevamento è imperfetto, se il layer viene implementato la **revisione dell'utente sul testo anonimizzato dovrebbe essere obbligatoria** prima di inviarlo al provider remoto: è l'utente a confermare che nulla di sensibile stia uscendo, non l'automatismo.
- **Vault dei segnaposto.** La mappatura va conservata in un **vault locale [cifrato](../glossario/cifratura.md)** a riposo, riusando lo stesso schema delle [chiavi API](./gestione-api-key.md): AES-256-GCM con cifratura a busta ancorata al secure storage del SO (vedi [cifratura e chiavi](./cifratura-e-chiavi.md)), senza un meccanismo separato. I segnaposto devono restare stabili e coerenti nel testo per non perdere le relazioni tra le entità.

## Limiti e cautele

- Resta una **mitigazione opzionale** per il caso "provider remoto": i [modelli eseguiti in locale](./provider-llm.md) restano la garanzia più forte, perché nessun dato esce.
- Il rilevamento è **imperfetto** (falsi negativi): richiede messa a punto sull'italiano e sul lessico legale e la revisione dell'utente prima dell'invio.
- L'anonimizzazione può **ridurre la qualità** della risposta se il modello ha bisogno delle entità reali per ragionare: è un trade-off utilità/privacy.
- Il vault va [cifrato](../glossario/cifratura.md) (vedi [sicurezza](../requisiti/sicurezza.md)) e i segnaposto devono restare coerenti per non perdere le relazioni nel testo.
