---
type: Concetto
title: Operazioni multi-documento
description: Applicare la stessa analisi, redazione o modifica tracciata a più documenti di un progetto in un'unica operazione.
tags: [documenti, batch, multi-documento]
timestamp: 2026-06-30T00:00:00Z
---

# Operazioni multi-documento

Consente di eseguire la **stessa operazione su molti [documenti](../modello-dati/documento.md) insieme**, anziché ripeterla manualmente su ciascuno.

## Esempi

- Applicare la stessa [modifica tracciata](./revisione-tracciata.md) (es. cambiare una definizione ricorrente) a tutti i contratti di un [progetto](./progetti.md).
- Replicare un documento modello e adattarlo a più casi.
- Lanciare la stessa [analisi](./analisi-documenti.md) su un'intera cartella e raccoglierne gli esiti.

Quando l'obiettivo è **estrarre dati comparabili** da molti documenti, la modalità dedicata è la [revisione tabellare](./revisione-tabellare.md).

## Note

- L'esito di ogni documento resta indipendente e tracciato singolarmente.

## Limiti di scala

> Funzionalità di **produttività avanzata** (Fase 4 della [Roadmap](../requisiti/roadmap.md)), fuori [MVP](../requisiti/mvp.md): qui si fissano i limiti di scala e il comportamento, non un dettaglio MVP.

Poiché tutto gira **in locale** (vedi [app desktop](../architettura/deployment.md)), la scala è vincolata dalle risorse della macchina dell'utente.

- **Tetto per lotto**: limite iniziale **conservativo (~50 documenti per operazione)**, elastico in base alle risorse locali.
Il numero è **provvisorio** e va confermato con i target hardware dei [requisiti non funzionali](../requisiti/requisiti-non-funzionali.md); oltre la soglia, l'operazione va suddivisa in più lotti.
- **Comportamento sui lotti grandi**: l'operazione entra in **coda** su un [worker separato](../architettura/worker-ingest.md), mostra l'**avanzamento** e produce **risultati parziali** man mano, con possibilità di **ripresa** dopo un'interruzione.
Ogni documento è indipendente: l'errore su uno **non fa fallire l'intero lotto**, ma viene segnalato e isolato.
- **Risorse locali**: esecuzione **sequenziale o a concorrenza limitata**, così da **non bloccare l'assistente** né saturare CPU/memoria durante il lotto.
