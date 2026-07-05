---
type: Concetto
title: Privacy e dati personali
description: Privacy by design, controllo dell'utente sui propri documenti e conformità al GDPR nel trattamento dei dati.
tags: [privacy, gdpr, dati-personali]
timestamp: 2026-07-05T00:00:00Z
---

# Privacy e dati personali

I documenti caricati dall'utente (contratti, atti, pareri) contengono spesso dati personali e informazioni riservate — incluse, di frequente, **categorie particolari ex art. 9 GDPR** (es. dati sulla salute) e **dati relativi a condanne e reati ex art. 10** — soggette a tutele rafforzate: il loro trattamento è un requisito di prodotto, non un dettaglio.

## Riservatezza: la leva primaria

Per gli studi legali la preoccupazione principale non è il costo, ma la **riservatezza dei dati dei clienti**: il timore che atti e documenti, se inseriti in piattaforme di terzi, possano finire online o essere esposti. È la leva su cui orientare sia la comunicazione sia lo **sviluppo** del prodotto.

La risposta architetturale è diretta: Magistra è un'[app desktop locale](../architettura/deployment.md) e i dati **non lasciano la macchina dell'utente**. La garanzia è piena con [modelli LLM eseguiti in locale](../architettura/provider-llm.md); se l'utente configura un provider remoto, ciò che gli viene inviato esce dalla macchina — perciò la scelta dev'essere **trasparente** e il supporto ai modelli locali è una priorità di sviluppo.

## Principi

- **Privacy by design**: i [documenti](../modello-dati/documento.md) dell'utente restano sotto il suo controllo; l'app gira interamente in locale, così i dati non lasciano la sua macchina.
- **Minimizzazione**: si conservano solo i dati necessari al servizio.
- **Conformità [GDPR](../glossario/gdpr.md)**: base giuridica del trattamento, diritti dell'interessato (accesso, cancellazione), conservazione limitata.
- **Ruoli del trattamento**: lo studio legale che usa Magistra è il **titolare del trattamento** dei documenti dei propri clienti; Magistra è uno strumento che gira sulla macchina dell'utente e i cui fornitori **non accedono ai dati**, perciò di norma non sono né titolari né responsabili del trattamento. Questo rafforza la garanzia di riservatezza.
- **Separazione**: i dati applicativi dell'utente (vedi [modello applicativo](../modello-dati/modello-applicativo.md)) sono distinti dal corpus normativo pubblico.

## Implicazioni tecniche

- I file risiedono nell'[archiviazione locale](../architettura/archiviazione-documenti.md) sulla macchina dell'utente.
- Le credenziali e le [API key](../architettura/gestione-api-key.md) sono [cifrate](../glossario/cifratura.md) — vedi [Sicurezza](./sicurezza.md).
- Attenzione all'invio di dati ai [provider LLM](../architettura/provider-llm.md) esterni: va reso trasparente e, ove richiesto, evitabile con modelli locali; un'[anonimizzazione reversibile](../architettura/anonimizzazione-reversibile.md) dei dati sensibili resta una mitigazione possibile ma **fuori dall'MVP**.

> Nessun dato personale o documento riservato va inserito nel repository del progetto.
