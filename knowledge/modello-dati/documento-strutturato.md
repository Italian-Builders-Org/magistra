---
type: Concetto
title: Documento strutturato
description: Rappresentazione intermedia verificabile dei documenti utente, indipendente dal formato sorgente e pronta per analisi e RAG.
tags: [documenti, struttura, estrazione, rag]
timestamp: 2026-07-12T00:00:00Z
---

# Documento strutturato

Il Documento strutturato è il modello intermedio prodotto dalla [conversione documenti](../architettura/conversione-documenti.md) a partire da un [Documento](./documento.md) dell'utente.
Separa i problemi specifici dei formati PDF, DOCX e ODT dalle funzionalità di analisi, ricerca semantica e RAG.

Non sostituisce il file originale: è un artefatto derivato, rigenerabile e conservato nell'[archiviazione locale](../architettura/archiviazione-documenti.md).

## Contratto di ingresso

La normalizzazione riceve il risultato dell'estrazione e non invoca direttamente convertitori o parser specifici del formato.
Il contratto di ingresso espone almeno:

| Campo | Descrizione |
|---|---|
| `source_path` | riferimento al file originale conservato localmente |
| `source_format` | formato rilevato dall'estrattore |
| `faithful_text` | contenuto testuale fedele |
| `pages` / `blocks` | pagine, blocchi e struttura disponibili nella fonte |
| `warnings` | anomalie o perdite rilevate durante l'estrazione |
| `extraction_method` | estrazione nativa, parsing PDF oppure OCR |
| `confidence` | confidenza quando il contenuto deriva da OCR |

Gli estrattori possono aggiungere dati specifici del formato, ma il normalizzatore li converte nel modello canonico senza richiedere alle funzioni di analisi di conoscere PDF, DOCX o ODT.

## Artefatti

Per ogni versione elaborata del documento la pipeline conserva:

| Artefatto | Scopo |
|---|---|
| File originale | Fonte immutata e riferimento ultimo per la verifica |
| `document.md` | Vista fedele e leggibile, con struttura, tabelle e marcatori di pagina |
| `document.json` | Document AST completo, con metadati, blocchi, ordine e provenienza |
| `chunks.jsonl` | Segmenti AI-ready derivati dai blocchi strutturati |
| `assets/` | Immagini e altri asset estratti, quando presenti |

## Document AST

Il Document AST descrive il documento come sequenza ordinata di blocchi.
Ogni blocco contiene almeno:

| Campo | Descrizione |
|---|---|
| `id` | identificativo stabile nel documento elaborato |
| `type` | tipo del blocco |
| `reading_order` | posizione nell'ordine di lettura ricostruito |
| `text` | contenuto fedele, quando applicabile |
| `source` | riferimento alla pagina o sezione di origine e, quando disponibile, intervallo di caratteri |
| `extraction_method` | estrazione nativa, parsing PDF oppure OCR |
| `confidence` | confidenza dell'estrazione, obbligatoria per i blocchi OCR |

I tipi minimi di blocco sono:

- titolo e intestazione;
- paragrafo;
- elenco e voce di elenco;
- tabella, righe e celle;
- nota e piè di pagina;
- immagine e didascalia;
- interruzione di pagina;
- codice o testo preformattato;
- collegamento;
- campo modulo, quando presente.

Le pagine conservano numero, dimensioni e orientamento.
L'orientamento orizzontale è un metadato della pagina e non viene rappresentato introducendo ritorni a capo artificiali nel testo.

## Provenienza

Ogni trasformazione deve poter risalire al contenuto originale.
Un blocco conserva almeno la pagina o la sezione sorgente; quando il parser lo permette, registra anche `block_id`, `char_start` e `char_end`.

Il testo ottenuto tramite OCR registra inoltre la confidenza, così l'assistente e l'interfaccia possono segnalare contenuti incerti invece di presentarli come equivalenti al testo digitale.

## Normalizzazione

La normalizzazione è deterministica e può:

- uniformare Unicode, spazi e terminatori di riga;
- ricomporre parole spezzate artificialmente a fine riga;
- rimuovere intestazioni, piè di pagina e numeri di pagina ripetuti dalla sequenza testuale, conservandone la provenienza;
- ricostruire titoli, elenchi, tabelle e ordine di lettura;
- segnalare anomalie senza correggere arbitrariamente il contenuto.

La normalizzazione non riassume, interpreta o riscrive il testo.
Una trasformazione assistita da LLM è un artefatto distinto e mantiene riferimenti ai blocchi da cui deriva.

## Chunk AI-ready

Questi [chunk](../glossario/chunk.md) derivano dai documenti dell'utente e sono distinti dal [Chunk del corpus normativo](./chunk.md), che è indicizzato per unità con metadati di citazione ELI.
Qui non esistono `unita_id` né `metadati_citazione`: la provenienza è verso i blocchi del Document AST e le pagine del file originale.

I chunk vengono costruiti dal Document AST e non direttamente dal testo appiattito.
Ogni chunk contiene almeno:

| Campo | Descrizione |
|---|---|
| `id` | identificativo del chunk |
| `heading_path` | percorso gerarchico dei titoli |
| `text` | contenuto del segmento |
| `page_start` / `page_end` | intervallo di pagine sorgente |
| `source_block_ids` | blocchi del Document AST da cui deriva |
| `token_estimate` | stima della dimensione per il modello |

Il chunking rispetta sezioni, paragrafi, punti elenco e tabelle, non taglia frasi quando evitabile e non divide una tabella in segmenti ambigui.

## Invarianti

- Il file originale e l'estrazione fedele non vengono sovrascritti.
- Ogni blocco e chunk mantiene una provenienza verificabile.
- Le tabelle restano strutturate e non vengono appiattite in una sequenza ambigua.
- Le pagine prive di testo utilizzabile vengono riconosciute e indirizzate all'estrazione OCR selettiva per pagina.
- Gli artefatti derivati sono rigenerabili dalla stessa versione del file originale e dal medesimo contratto di estrazione.
