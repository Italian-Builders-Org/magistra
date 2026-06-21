---
type: Concetto
title: Privacy e dati personali
description: Privacy by design, controllo dell'utente sui propri documenti e conformità al GDPR nel trattamento dei dati.
tags: [privacy, gdpr, dati-personali]
timestamp: 2026-06-20T00:00:00Z
---

# Privacy e dati personali

I documenti caricati dall'utente (contratti, atti, pareri) contengono spesso dati personali e informazioni riservate: il loro trattamento è un requisito di prodotto, non un dettaglio.

## Principi

- **Privacy by design**: i [documenti](/modello-dati/documento.md) dell'utente restano sotto il suo controllo; l'architettura permette il [self-hosting](/glossario/self-hosting.md) completo, così i dati non lasciano l'ambiente dell'organizzazione.
- **Minimizzazione**: si conservano solo i dati necessari al servizio.
- **Conformità [GDPR](/glossario/gdpr.md)**: base giuridica del trattamento, diritti dell'interessato (accesso, cancellazione), conservazione limitata.
- **Separazione**: i dati applicativi dell'utente (vedi [modello applicativo](/modello-dati/modello-applicativo.md)) sono distinti dal corpus normativo pubblico.

## Implicazioni tecniche

- I file risiedono nell'[object storage](/architettura/object-storage.md) dell'istanza.
- Le credenziali e le [API key](/architettura/gestione-api-key.md) sono [cifrate](/glossario/cifratura.md): vedi [Sicurezza](/requisiti/sicurezza.md).
- Attenzione all'invio di dati ai [provider LLM](/architettura/provider-llm.md) esterni: va reso trasparente e, ove richiesto, evitabile con modelli locali.

> Nessun dato personale o documento riservato va inserito nel repository del progetto.
