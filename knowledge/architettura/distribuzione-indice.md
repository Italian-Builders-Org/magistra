---
type: Processo
title: Distribuzione e aggiornamento dell'indice normativo
description: Contratto documentale per distribuire e aggiornare l'indice normativo pre-costruito come pacchetto dati separato, read-only, versionato e verificabile.
tags: [distribuzione, indice, aggiornamento, versionamento]
timestamp: 2026-07-04T00:00:00Z
---

# Distribuzione e aggiornamento dell'indice normativo

Il [deployment](./deployment.md) stabilisce che l'[indice normativo](./indice-normativo.md) non viene "ingestato" sul dispositivo di ogni utente: è il team a costruirlo in un ambiente controllato e a distribuire un **indice già pronto**, con possibilità di aggiornamento.
Il [packaging](./packaging-distribuzione.md) tiene poi distinto l'aggiornamento dell'**applicazione** (via `electron-updater` e GitHub Releases) da quello dell'**indice**.

Questo documento fissa il contratto della prima implementazione per canale, pacchetto, verifica e attivazione dell'indice.
Le decisioni qui raccolte sono vincoli logici della prima implementazione e si appoggiano ai [requisiti non funzionali](../requisiti/requisiti-non-funzionali.md) e alla strategia dell'[indice normativo](./indice-normativo.md).

## Vincoli fermi

- **Pacchetto dati separato e read-only**: l'indice è un artefatto prodotto dal team, identico per tutti gli utenti, che l'app **non modifica** a runtime ma solo consulta. È fisicamente separato dal [database applicativo](./database-applicativo.md) (PGlite), che invece contiene i dati dell'utente e muta in locale: directory e ciclo di vita distinti nella cartella dati.
- **Canale proprio, distinto da quello dell'app**: l'indice si aggiorna su un canale suo, così una nuova versione del corpus non impone una nuova build dell'app e viceversa.
- **Consegna: starter minimo più download**: l'installer include al massimo uno **starter index minimo** (o nessun indice), giusto per un primo avvio utile; l'indice completo viene **scaricato al primo avvio** (su TLS) dal canale dell'indice.

## Canale di distribuzione

Il canale sono le **GitHub Releases** dell'artefatto indice (asset di release): stesso ecosistema dell'[auto-update dell'app](./packaging-distribuzione.md) e **gratuito** per un progetto open source, perché gli asset di release non hanno costi di storage né di banda e sono già serviti da CDN.
L'unico limite è di **2 GiB per singolo file**, quindi a corpus pieno il pacchetto si **segmenta** in più asset (fino a 1000 per release).
Se un giorno servisse un singolo file oltre i 2 GiB senza segmentarlo, il ripiego è servirlo dal **sito del progetto**; **Git LFS** non è invece la via, perché è a pagamento oltre una quota minima ed è pensato per versionare file dentro il repo, non per distribuirli.
La scelta è **reversibile**: se i vincoli cambiano il canale si può spostare, dietro la stessa interfaccia di download.

## Cosa deve garantire un aggiornamento

Indipendentemente dal meccanismo scelto, un aggiornamento dell'indice deve essere:

- **Verificabile prima di attivarsi**: integrità del pacchetto (checksum) e compatibilità con l'app (versione dello schema dei metadati del [Chunk](../modello-dati/chunk.md), **modello di [embedding](../glossario/embedding.md)** e versione minima dell'app). Il pin del modello di embedding è il vincolo più delicato: query e indice sono confrontabili solo se prodotti dallo stesso embedder, e un disallineamento non dà errore ma abbatte in silenzio la recall, quindi un indice con embedder non corrispondente va rifiutato.
- **Atomico e reversibile**: l'indice in uso non viene corrotto da un aggiornamento fallito, e in caso di problema si resta (o si torna) alla versione precedente. Poiché l'indice è read-only a runtime, l'unico momento di scrittura è l'attivazione della nuova versione, fuori dal percorso di lettura dell'assistente.

## Versionamento e multivigenza

Sono due assi distinti, da non confondere:

- la **versione dell'artefatto** dice quanto è fresco lo snapshot del corpus (fino a quale data le modifiche normative sono incluse);
- la **[multivigenza](../glossario/multivigenza.md)** è la validità temporale delle norme *dentro* l'indice: la domanda "il testo in vigore alla data X" si risolve filtrando per [vigenza](../glossario/vigenza.md) sui metadati del chunk, dentro l'artefatto installato.

Aggiornare l'artefatto rinfresca il corpus; interrogare una data resta un prefiltro sui metadati, non un cambio di artefatto.
Ne segue che l'indice conserva anche le versioni storiche entro la copertura dichiarata, non solo il testo vigente.

## Decisioni della prima implementazione

- **Granularità degli aggiornamenti**: la prima implementazione distribuisce snapshot completi e versionati dell'indice. Gli incrementali sono esclusi dal contratto iniziale, perché la [multivigenza](../glossario/multivigenza.md) rende ogni aggiornamento più complesso di un puro append: una nuova versione di una norma chiude anche la [vigenza](../glossario/vigenza.md) dei chunk precedenti.
- **Variante da distribuire e peso del pacchetto**: la variante segue la strategia definita nell'[indice normativo](./indice-normativo.md): flat/esatto alla scala MVP, IVF_HNSW a piena precisione quando il corpus cresce, IVF_HNSW + RaBitQ solo se il footprint del corpus pieno lo richiede. Ogni release dell'indice dichiara nel manifest variante, modello di embedding, dimensioni, schema dei metadati e peso del pacchetto.

## Dipendenze

Poggia su [packaging e distribuzione desktop](./packaging-distribuzione.md) (#11) e sul pattern di accesso dell'indice (#13), entrambi chiusi.
Usa la misura di recall dell'indice e le soglie di spazio definite nei [requisiti non funzionali](../requisiti/requisiti-non-funzionali.md) per verificare la variante distribuita.
