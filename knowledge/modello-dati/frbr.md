---
type: Concetto
title: Il modello FRBR di Akoma Ntoso
description: I quattro livelli (Work, Expression, Manifestation, Item) con cui AKN gestisce versioni, formati e derivazioni di una norma.
tags: [frbr, akoma-ntoso, versioni]
timestamp: 2026-07-05T00:00:00Z
---

# Il modello FRBR di Akoma Ntoso

[Akoma Ntoso](../glossario/akoma-ntoso.md) adotta il modello **[FRBR](../glossario/frbr.md)** per gestire le numerose derivazioni dei testi normativi (modifiche, versioni, lingue). Quattro livelli:

| Livello | Significato | Esempio |
|---|---|---|
| **Work** | La norma in astratto, in tutte le sue versioni | "L. 241/1990" |
| **Expression** | Una versione specifica nel tempo/lingua | "L. 241/1990 vigente al 2020-01-01" |
| **Manifestation** | Una rappresentazione in un formato | il file XML AKN di quella versione |
| **Item** | La copia concreta (file) | il file scaricato e archiviato |

Questi livelli sono dichiarati nel blocco `<meta>` → `<identification>` tramite `<FRBRWork>`, `<FRBRExpression>`, `<FRBRManifestation>`, `<FRBRItem>`.

Questo modello è il motivo per cui Magistra può distinguere "il testo vigente oggi" da "il testo in vigore nel 2015".

## Mappatura in Magistra

Per l'MVP Magistra modella come entità applicative solo i livelli necessari al retrieval e alle citazioni:

| Livello FRBR | Entità Magistra | Decisione |
|---|---|---|
| Work | [Norma](./norma.md) | Entità stabile identificata da `eli`. |
| Expression | [Versione](./versione.md) | Entità versionata nel tempo, con intervallo di vigenza. |
| Manifestation | metadati della Versione | Non diventa tabella MVP; si conservano formato, URI/file sorgente, hash e data acquisizione. |
| Item | artefatto di ingest / file locale | Non diventa tabella MVP; la copia fisica è un dettaglio di pipeline e storage. |

Manifestation e Item possono diventare entità separate solo se servirà gestire più formati o più copie fisiche della stessa Expression. Finché l'obiettivo è rispondere con fonti, vigenza e citazioni verificabili, Work + Expression + Unità sono il nucleo stabile.
