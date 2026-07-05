---
type: Concetto
title: Calcolo di pene e termini
description: Calcolo regolato di termini processuali e limiti di pena (continuazione, prescrizione, impugnazioni), con la base normativa citata e senza affidarlo alla generazione dell'LLM.
tags: [calcolo-pena, termini, penale, affidabilita]
timestamp: 2026-07-01T00:00:00Z
---

# Calcolo di pene e termini

Capacità di calcolare in modo **affidabile** termini processuali e limiti di pena, building block del [ragionamento strategico](./ragionamento-strategico.md). Sono numeri da cui dipendono scelte difensive: devono essere **corretti e verificabili**, non stime generate a memoria.

> Funzionalità di **Fase 2** (post-MVP), da avviare quando l'infrastruttura [RAG](../glossario/rag-agentico.md) è stabile: non fa parte dell'[MVP](../requisiti/mvp.md) (vedi [Roadmap](../requisiti/roadmap.md)).
> La sezione [Copertura (Fase 2)](#copertura-fase-2) fissa gli istituti coperti e i limiti; la specifica di dettaglio si scrive all'avvio della Fase 2.

## Cosa calcola: il confine deterministico/discrezionale

Va distinto ciò che è **computabile in modo esatto** da ciò che resta **discrezionale** del giudice e che lo strumento può solo inquadrare, non quantificare al posto suo:

- **Termini processuali**: computo dei termini e relative decorrenze, con la **sospensione feriale**. Sono **deterministici**. I termini di **impugnazione e opposizione**, pur deterministici, hanno troppe casistiche e sono rinviati alla Fase 3 (vedi [Copertura](#copertura-fase-2)).
- **Prescrizione**: termini e loro decorrenza/sospensioni/interruzioni. In larga parte **deterministica**, una volta noti gli eventi rilevanti.
- **Pena**: **limiti edittali** (minimo/massimo), effetti aritmetici di circostanze a frazione fissa, tetti del cumulo materiale e giuridico. Sono i **confini** entro cui ragionare. Restano invece **discrezionali** — e quindi non "calcolabili" — il *quantum* in concreto, l'aumento per la **continuazione ex art. 81 c.p.** (fino al triplo), il **bilanciamento delle circostanze ex art. 69 c.p.** e l'applicazione della **recidiva facoltativa ex art. 99 c.p.**

## Copertura (Fase 2)

Istituti coperti al lancio della feature (Fase 2), sulla base dell'input dell'esperto di dominio legale.

### Istituti coperti

- **Prescrizione** con sospensioni e interruzioni.
- **Continuazione** e **cumulo** materiale/giuridico.
- **Sospensione feriale** dei termini.
- **Circostanze aggravanti e attenuanti comuni** (artt. 61, 62, 62-bis c.p.): insieme definito e gestibile.
- **Recidiva** (art. 99 c.p.).

### Confine deterministico/discrezionale

Lo strumento **calcola e cita** la norma applicata, ma **segnala esplicitamente** ogni punto in cui interviene la discrezionalità giudiziale, senza simularla:

- determinazione della **pena base**;
- **bilanciamento delle circostanze** (art. 69 c.p.): il giudice può ritenerle prevalenti, equivalenti o soccombenti — il tool segnala, non decide;
- riconoscimento delle **attenuanti generiche** (art. 62-bis c.p.);
- valutazione della **recidiva** (art. 99 c.p.).

Nessun output probabilistico: solo **calcolo deterministico** con norma citata più segnalazione dei punti discrezionali.

### Requisito irrinunciabile: multivigenza temporale

Il motore applica la **norma vigente al momento del fatto**, non solo quella attuale: lo impongono il **favor rei** e l'**irretroattività della norma sfavorevole** (art. 2 c.p.).
Si sfruttano i metadati di [vigenza](../glossario/vigenza.md) e le **versioni storiche di [Normattiva](../fonti/normattiva.md)**, senza costruire un'infrastruttura parallela.

### Rinviato alla Fase 3

- **Aggravanti e attenuanti speciali**: richiedono il corpus completo reato per reato.
- **Termini di impugnazione e opposizione**: troppe casistiche, meritano un modulo dedicato.

## Principio: calcolo regolato, non generato

Dove il risultato è determinato dalle regole, il calcolo è **deterministico e basato su regole**, non prodotto dalla generazione dell'[LLM](../architettura/provider-llm.md): l'assistente orchestra e spiega il risultato, ma i numeri provengono da una logica di calcolo legata alla norma applicabile. Ogni risultato riporta la **base normativa** ([citazione verificabile](../glossario/citazione-verificabile.md)) e i passaggi del calcolo; dove la determinazione è discrezionale, lo strumento espone la **forbice** e i criteri, non un valore unico spacciato per certo.

Questo evita le [allucinazioni](../glossario/allucinazione.md) proprio dove sarebbero più pericolose — su date, termini e quantificazioni — e mantiene la [groundedness](../glossario/groundedness.md) del prodotto.

## Confine: supporto, non sostituzione

I calcoli **affiancano** il professionista e non sostituiscono la sua valutazione né l'esercizio della discrezionalità del giudice: non sono [consulenza legale](./assistente-legale.md) e non garantiscono esiti (vedi [ragionamento strategico](./ragionamento-strategico.md)).

## Relazioni

- Alimenta il [ragionamento strategico](./ragionamento-strategico.md): le conseguenze degli scenari poggiano su questi calcoli.
- Usa i metadati di [vigenza](../glossario/vigenza.md) per applicare la disciplina corretta nel tempo.
