---
type: Processo
title: Distribuzione e aggiornamento dell'indice normativo
description: Inquadramento (bozza) di come l'indice normativo pre-costruito viene veicolato e aggiornato come pacchetto dati separato, read-only e versionato, con i vincoli fermi e le decisioni ancora aperte.
tags: [distribuzione, indice, aggiornamento, versionamento]
timestamp: 2026-07-04T00:00:00Z
---

# Distribuzione e aggiornamento dell'indice normativo

Il [deployment](./deployment.md) stabilisce che l'[indice normativo](./indice-normativo.md) non viene "ingestato" sul dispositivo di ogni utente: è il team a costruirlo in un ambiente controllato e a distribuire un **indice già pronto**, con possibilità di aggiornamento.
Il [packaging](./packaging-distribuzione.md) tiene poi distinto l'aggiornamento dell'**applicazione** (via `electron-updater` e GitHub Releases) da quello dell'**indice**.

Questo documento **inquadra** il problema che quei due lasciano aperto (canale e meccanismo di aggiornamento dell'indice) e ne fissa i vincoli.
È una **bozza**: i dettagli meccanici sono rimandati a un passo di design successivo, quando saranno fissati i [requisiti non funzionali](../requisiti/requisiti-non-funzionali.md) di spazio e dimensione (#27) e sarà disponibile una misura di recall su dati veri (vedi [indice normativo](./indice-normativo.md)).

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

## Decisioni aperte

- **Granularità degli aggiornamenti**: snapshot completi (più semplici da rendere corretti) contro incrementali (più leggeri da scaricare). La [multivigenza](../glossario/multivigenza.md) complica gli incrementali, perché una nuova versione di una norma non è un puro append: chiude anche la [vigenza](../glossario/vigenza.md) dei chunk precedenti.
- **Variante da distribuire e peso del pacchetto**: quale variante dell'[indice](./indice-normativo.md) si spedisce incide sulla dimensione del download, e il compromesso tra footprint e recall (specie la recall sotto filtro) dipende dalla misura su dati veri ancora in corso e dai target di spazio su disco (#27).

## Dipendenze

Poggia su [packaging e distribuzione desktop](./packaging-distribuzione.md) (#11) e sul pattern di accesso dell'indice (#13), entrambi chiusi.
Interseca la misura di recall dell'indice, da cui dipende la scelta della variante e quindi il peso del pacchetto.
