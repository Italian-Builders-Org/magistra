# Magistra

> Piattaforma open source basata su AI per la legislazione italiana.

L'obiettivo è offrire un assistente legale AI con chat, ricerca normativa e analisi documentale, interamente fondato su fonti del diritto italiano e con citazioni verificabili.

Questo prodotto è ideato, gestito e costruito dalla community **[Italian Builders](https://italianbuilders.co)** — trovaci su [X (@italianbldrs)](https://x.com/italianbldrs) e su [italianbuilders.co](https://italianbuilders.co).

⚠️ **Disclaimer**: Magistra è uno strumento di supporto informativo. Non fornisce consulenza legale e non sostituisce il parere di un avvocato o di un professionista abilitato.

---

## Visione

Rendere il diritto italiano più accessibile e navigabile attraverso un assistente AI affidabile, trasparente e open source, che cita sempre le fonti e non "inventa" norme.

I principi guida sono tre:

- **Citazioni sempre verificabili**: ogni risposta rimanda all'articolo, al comma e alla fonte ufficiale (URI ELI / Normattiva).
- **Trasparenza**: codice, prompt e pipeline di dati sono aperti e ispezionabili.
- **Privacy by design**: i documenti dell'utente restano sotto il suo controllo; possibilità di esecuzione self-hosted.

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

- **Frontend**: Next.js (TypeScript)
- **Backend**: API Node/Express (TypeScript)
- **Database**: PostgreSQL + estensione vettoriale (es. `pgvector`) per la ricerca semantica
- **Storage**: object storage compatibile S3 (MinIO, self-hosted) per i documenti
- **Pipeline dati**: ingest da Normattiva (Akoma Ntoso → parsing → chunking → embedding)
- **RAG**: retrieval con citazioni → generazione con LLM
- **Modelli**: configurabili, almeno un provider a scelta (con possibilità di modelli locali/self-hosted)

```
Utente → Frontend (Next.js)
            │
            ▼
        Backend / API ──► Vector DB (pgvector) ──► Fonti normative (Akoma Ntoso / ELI)
            │
            ▼
          LLM (RAG con citazioni)
```

---

## Contribuire

Il progetto è agli inizi e i contributi sono benvenuti: pipeline dati, parsing Akoma Ntoso, frontend, valutazione della qualità delle risposte, documentazione.

1. Apri una *issue* per proposte o bug.
2. Per modifiche, apri una *pull request* con descrizione chiara.
3. Le linee guida dettagliate (`CONTRIBUTING.md`) saranno aggiunte a breve.

---

## Documentazione

La knowledge base del progetto è in [`knowledge/`](knowledge/), strutturata come bundle **[Open Knowledge Format (OKF) v0.1](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)**: una directory di file Markdown con frontmatter YAML, dove ogni concetto (fonte, entità, componente, termine) è un documento autonomo e collegabile, leggibile sia da persone sia da agenti AI.

- [Fonti dei dati](knowledge/fonti/index.md) — fonti normative, formati e condizioni di riuso.
- [Modello dati e parsing Akoma Ntoso](knowledge/modello-dati/index.md) — FRBR, ELI, schema interno e pipeline.
- [Architettura](knowledge/architettura/index.md) — componenti e flusso RAG.
- [Glossario](knowledge/glossario/index.md) — termini giuridici e tecnici.

### Aprire la knowledge base in Obsidian

La cartella [`knowledge/`](knowledge/) è anche un **vault [Obsidian](https://obsidian.md/)**: aprila come vault per esplorare i concetti e i loro collegamenti nella vista a grafo. La configurazione del vault è versionata in `knowledge/.obsidian/`, così chiunque cloni il repository ottiene la **stessa configurazione** (plugin, aspetto, impostazioni del grafo) senza doverla ricreare.

Per contribuire: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Community

Magistra è un progetto **interamente ideato, gestito e costruito dalla community Italian Builders**, un collettivo di builder italiani che realizza prodotti open source.

- **Sito**: [italianbuilders.co](https://italianbuilders.co)
- **X / Twitter**: [@italianbldrs](https://x.com/italianbldrs)

Se vuoi contribuire o entrare in contatto con la community, parti da qui.

## Contributors

Un grazie speciale ai nostri contributori!
<a href="https://github.com/go-skynet/LocalAI/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=go-skynet/LocalAI" />
</a>

---

## Licenza

Da definire. Si propone **AGPL-3.0** per garantire che le derivazioni restino aperte.

---

*Questo è un documento di bozza iniziale: visione, funzionalità e architettura sono soggette a discussione e revisione.*
