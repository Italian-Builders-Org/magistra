# Magistra

> Piattaforma open source basata su AI per la legislazione italiana.

L'obiettivo è offrire un assistente legale AI con chat, ricerca normativa e analisi documentale, interamente fondato su fonti del diritto italiano e con citazioni verificabili.

Questo prodotto è ideato, gestito e costruito dalla community **[Italian Builders](https://italianbuilders.co)** — trovaci su [X (@italianbldrs)](https://x.com/italianbldrs) e su [italianbuilders.co](https://italianbuilders.co).

⚠️ **Disclaimer**: Magistra è uno strumento di supporto informativo. Non fornisce consulenza legale e non sostituisce il parere di un avvocato o di un professionista abilitato.

---

## Stato attuale

Il progetto è agli **inizi**.
In questa fase il repository contiene:

- la **knowledge base** ([`knowledge/`](knowledge/)), con gli script per validarla e generarne un PDF;
- l'**app desktop Electron** in via di sviluppo, avviabile in locale;
- i package workspace condivisi per UI, contratti condivisi e worker.

Le funzionalità elencate più sotto (chat, ricerca semantica, analisi documenti) descrivono l'**obiettivo** del prodotto, non ciò che è già eseguibile oggi.

👉 **Per installazione, comandi e utilizzo pratico, leggi [`GETTING-STARTED.md`](GETTING-STARTED.md).**

---

## Visione

Rendere il diritto italiano più accessibile e navigabile attraverso un assistente AI affidabile, trasparente e open source, che cita sempre le fonti e non "inventa" norme.

I principi guida sono tre:

- **Citazioni sempre verificabili**: ogni risposta rimanda all'articolo, al comma e alla fonte ufficiale (URI ELI / Normattiva).
- **Trasparenza**: codice, prompt e pipeline di dati sono aperti e ispezionabili.
- **Privacy by design**: app desktop locale, i documenti dell'utente restano sulla sua macchina e sotto il suo controllo.

---

## Funzionalità

- **Chat legale con citazioni**: domande in linguaggio naturale con risposte ancorate alle fonti normative.
- **Ricerca semantica**: ricerca per concetto (non solo per parola chiave) su leggi, decreti e codici.
- **Analisi documenti**: caricamento di contratti, atti e PDF per riassunti, individuazione di clausole e verifica di riferimenti normativi.
- **Confronto versioni**: navigazione del testo vigente e delle versioni storiche di una norma (multivigenza).
- **Riferimenti incrociati**: collegamenti automatici tra norme citate, codici e normativa UE collegata.

---

## Fonti dei dati

Il progetto si fonda su fonti ufficiali e aperte:

- **[Normattiva Open Data](https://dati.normattiva.it/)** — leggi, decreti e atti in formato **Akoma Ntoso (LegalDOCML)**, **JSON** e **HTML**, con identificatori **ELI (European Legislation Identifier)** e API ufficiali.
- **Gazzetta Ufficiale** — pubblicazione degli atti.
- **EUR-Lex** — normativa dell'Unione Europea collegata.
- **Giurisprudenza** — sentenze di Corte Costituzionale e Corte di Cassazione (ove disponibili in formato aperto).

---

## Architettura (proposta)

Stack **TypeScript-first** end-to-end.
Magistra è un'**app desktop Electron** che gira interamente in locale, con tutti i dati sulla macchina dell'utente.

- **Frontend**: renderer React + Vite dentro Electron
- **Backend / API**: Node (TypeScript); l'ingest pesante gira come **job batch** separato dall'assistente
- **Database**: **PGlite** embedded (Postgres in WASM) con `pgvector` per la ricerca semantica
- **Storage**: filesystem locale per i documenti dell'utente
- **Distribuzione**: app desktop installabile con Electron, senza Docker
- **Pipeline dati**: ingest da Normattiva (Akoma Ntoso → parsing → chunking → embedding); indice distribuito già pronto nel bundle
- **RAG**: retrieval con citazioni → generazione con LLM
- **Modelli**: configurabili, almeno un provider a scelta (con possibilità di modelli eseguiti in locale)

```text
Utente → Renderer React (Electron)
            │
            ▼
        Backend / API ──► Vector DB (pgvector) ──► Fonti normative (Akoma Ntoso / ELI)
            │                  ▲
            ▼                  │ alimenta (processo separato)
          LLM (RAG con      Worker / ingest
          citazioni)
```

---

## Contribuire

Il progetto è agli inizi e i contributi sono benvenuti: pipeline dati, parsing Akoma Ntoso, frontend, valutazione della qualità delle risposte, documentazione.

1. Leggi [`GETTING-STARTED.md`](GETTING-STARTED.md) per setup e comandi disponibili.
2. Apri una *issue* per proposte o bug.
3. Per modifiche, apri una *pull request* con descrizione chiara ed esegui le verifiche indicate nel getting started.
4. Linee guida dettagliate: [`CONTRIBUTING.md`](CONTRIBUTING.md) e [`AGENTS.md`](AGENTS.md) (convenzioni della knowledge base).

---

## Documentazione

La knowledge base del progetto è in [`knowledge/`](knowledge/), strutturata come bundle **[Open Knowledge Format (OKF) v0.1](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)**: una directory di file Markdown con frontmatter YAML, dove ogni concetto (fonte, entità, componente, termine) è un documento autonomo e collegabile, leggibile sia da persone sia da agenti AI.

- [Fonti dei dati](knowledge/fonti/index.md) — fonti normative, formati e condizioni di riuso.
- [Modello dati e parsing Akoma Ntoso](knowledge/modello-dati/index.md) — FRBR, ELI, schema interno e pipeline.
- [Architettura](knowledge/architettura/index.md) — componenti e flusso RAG.
- [Glossario](knowledge/glossario/index.md) — termini giuridici e tecnici.
- [UI library](packages/ui/README.md) — componenti condivisi e aggiunta di componenti shadcn.

Per setup, avvio dell'app Electron, validazione, generazione PDF e apertura della knowledge base in Obsidian, usa [`GETTING-STARTED.md`](GETTING-STARTED.md).

Per contribuire: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Community

Magistra è un progetto **interamente ideato, gestito e costruito dalla community Italian Builders**, un collettivo di builder italiani che realizza prodotti open source.

- **Sito**: [italianbuilders.co](https://italianbuilders.co)
- **X / Twitter**: [@italianbldrs](https://x.com/italianbldrs)

Se vuoi contribuire o entrare in contatto con la community, parti da qui.

---

## Licenza

Il software è rilasciato sotto **[AGPL-3.0-or-later](LICENSE)**, per garantire che le derivazioni — incluse quelle erogate come servizio — restino aperte. Il testo integrale è nel file [`LICENSE`](LICENSE).

Le condizioni di riuso dei **dati** delle fonti sono trattate a parte (vedi [`knowledge/requisiti/licenze.md`](knowledge/requisiti/licenze.md)).

---

*Questo è un documento di bozza iniziale: visione, funzionalità e architettura sono soggette a discussione e revisione.*
