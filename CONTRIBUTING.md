# Contribuire a Magistra

Grazie per l'interesse verso **Magistra**! Il progetto è agli inizi e ogni contributo è prezioso: dati, parsing, valutazione qualità, documentazione e (più avanti) codice.

Il progetto è ideato, gestito e costruito dalla community **[Italian Builders](https://italianbuilders.co)** ([@italianbldrs](https://x.com/italianbldrs)): unisciti a noi.

## Setup e utilizzo

Prima di contribuire, leggi [`GETTING-STARTED.md`](GETTING-STARTED.md): spiega lo **stato attuale del repository** (knowledge base + script, senza app eseguibile), come clonare il progetto, i comandi `npm test` e `npm run build:pdf`, e come esplorare la documentazione in Obsidian.

Setup minimo:

```bash
git clone https://github.com/Italian-Builders-Org/Italian-OSS-Legal-Platform.git
cd Italian-OSS-Legal-Platform
npm install
npm test
```

## Come puoi aiutare

In questa fase il focus è la **knowledge base** e la pipeline dei dati. La knowledge base è un bundle **[Open Knowledge Format (OKF)](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)** in [`knowledge/`](knowledge/): un concetto per file Markdown, con frontmatter YAML (`type` obbligatorio; `title`, `description`, `resource`, `tags`, `timestamp` opzionali) e `index.md` per ogni cartella. Aree dove serve aiuto:

- **Fonti dati**: mappare e documentare fonti normative italiane aperte (vedi [`knowledge/fonti/`](knowledge/fonti/index.md)).
- **Parsing Akoma Ntoso / NIR**: definire e validare lo schema di estrazione (vedi [`knowledge/modello-dati/`](knowledge/modello-dati/index.md)).
- **Qualità delle risposte**: proporre set di domande di test e criteri di valutazione delle citazioni.
- **Documentazione**: migliorare, correggere e tradurre i concetti in `knowledge/`, rispettando il formato OKF (frontmatter YAML, un concetto per file).
- **Glossario**: arricchire il [`knowledge/glossario/`](knowledge/glossario/index.md) con termini giuridici e tecnici (un file per termine).

## Flusso di lavoro

1. **Apri una issue** prima di lavori non banali, così da discutere l'approccio ed evitare duplicazioni.
2. Usa etichette chiare: `dati`, `documentazione`, `parsing`, `domanda`, `bug`.
3. Per modifiche: **fork → branch → pull request** con descrizione di *cosa* e *perché*.
4. Mantieni le PR piccole e focalizzate su un solo tema.
5. Prima di aprire la PR, esegui `npm test` per validare la knowledge base (regole in [`AGENTS.md`](AGENTS.md)).

## Convenzioni

- **Lingua**: documentazione e contenuti in **italiano**. Commenti tecnici in italiano.
- **Commit**: messaggi brevi e descrittivi. Consigliato il formato [Conventional Commits](https://www.conventionalcommits.org/) (es. `docs: aggiungi schema ELI`).
- **Markdown**: una frase per riga quando possibile, per *diff* più leggibili.

## Principi non negoziabili

Ogni contributo deve rispettare i principi del progetto:

- **Citazioni verificabili**: nessuna affermazione normativa senza riferimento alla fonte ufficiale.
- **Rispetto delle licenze**: i dati si usano e si ridistribuiscono solo nei termini consentiti (vedi [`knowledge/fonti/`](knowledge/fonti/index.md)).
- **Niente consulenza legale**: Magistra è uno strumento informativo, non sostituisce un professionista.
- **Privacy**: non inserire dati personali o documenti riservati nei test o nel repository.

## Codice di condotta

Mantieni un comportamento rispettoso e collaborativo. Comportamenti tossici o discriminatori non sono tollerati. (Un `CODE_OF_CONDUCT.md` formale sarà aggiunto.)

## Domande

Per dubbi apri una issue con etichetta `domanda`. Grazie per contribuire a rendere il diritto italiano più accessibile!
