# Inizia qui — Magistra

Questa guida spiega **cosa c'è oggi nel repository**, **come usarlo** e **cosa non è ancora disponibile**.

---

## Stato attuale del progetto

Magistra è agli **inizi**. In questa fase il repository contiene soprattutto:

- una **knowledge base** in [`knowledge/`](knowledge/) (documentazione strutturata in formato OKF);
- **script Node.js** per validare la knowledge base e generarne un PDF.

**Non esiste ancora un'applicazione eseguibile** (niente chat, niente frontend Next.js, niente app desktop installabile).
Le funzionalità descritte nel [README](README.md) (assistente AI, ricerca semantica, analisi documenti) sono l'**obiettivo del progetto**, non qualcosa che puoi avviare oggi con `npm run dev`.

| Cosa | Disponibile oggi? |
|---|---|
| Leggere/esplorare la documentazione in `knowledge/` | Sì |
| Aprire la knowledge base in Obsidian | Sì |
| Validare la knowledge base (`npm test`) | Sì |
| Generare un PDF della documentazione (`npm run build:pdf`) | Sì |
| Avviare l'assistente legale / l'app desktop | No (non ancora implementato) |

---

## Prerequisiti

- **[Node.js](https://nodejs.org/)** 18 o superiore (consigliato LTS)
- **[Git](https://git-scm.com/)** per clonare il repository
- Opzionale: **[Obsidian](https://obsidian.md/)** per navigare la knowledge base con grafo e link

Verifica Node.js:

```bash
node --version
npm --version
```

---

## Setup rapido

### 1. Clona il repository

```bash
git clone https://github.com/Italian-Builders-Org/Italian-OSS-Legal-Platform.git
cd Italian-OSS-Legal-Platform
```

Se hai già clonato il repo, entra nella cartella del progetto:

```bash
cd percorso/verso/Magistra
```

### 2. Installa le dipendenze

```bash
npm install
```

Le dipendenze servono agli script di validazione e generazione PDF (non a un'app web).

### 3. Verifica che tutto funzioni

```bash
npm test
```

Se la knowledge base è valida, vedrai un messaggio simile a:

```text
✓ Knowledge base valida.
```

---

## Come usare il progetto oggi

### Esplorare la documentazione (solo lettura)

La knowledge base è in [`knowledge/`](knowledge/).
Ogni file Markdown descrive **un solo concetto** (una fonte, un'entità dati, un termine, ecc.).

Punto di partenza consigliato:

- [`knowledge/index.md`](knowledge/index.md) — panoramica del bundle
- [`knowledge/fonti/index.md`](knowledge/fonti/index.md) — fonti normative
- [`knowledge/modello-dati/index.md`](knowledge/modello-dati/index.md) — modello dati e pipeline
- [`knowledge/architettura/index.md`](knowledge/architettura/index.md) — architettura proposta
- [`knowledge/glossario/index.md`](knowledge/glossario/index.md) — termini giuridici e tecnici

Puoi leggerli:

- direttamente su **GitHub** (clic sui file `.md`);
- in un editor di testo o IDE (Cursor, VS Code, ecc.);
- in **Obsidian** (vedi sezione sotto).

### Aprire la knowledge base in Obsidian

1. Installa [Obsidian](https://obsidian.md/).
2. Scegli **Open folder as vault**.
3. Seleziona la cartella **`knowledge/`** (non la radice del repository).

La configurazione del vault è già versionata in `knowledge/.obsidian/`, quindi ottieni la stessa esperienza di chiunque abbia clonato il repo (plugin, aspetto, impostazioni del grafo).

Nella **vista grafo** puoi vedere come i concetti si collegano tra loro.

### Validare la knowledge base

Prima di contribuire con modifiche alla documentazione, esegui sempre:

```bash
npm test
```

Comandi equivalenti:

```bash
npm run validate:kb
node scripts/validate-knowledge-base.mjs
```

Per fallire anche sui warning (utile in CI o prima di una PR importante):

```bash
npm run test:strict
```

Opzioni avanzate dello script:

```bash
node scripts/validate-knowledge-base.mjs --root knowledge
node scripts/validate-knowledge-base.mjs --strict
```

Lo script controlla frontmatter YAML, vocabolario di `type`, slug dei file, struttura delle cartelle, link interni e copertura negli `index.md`.
Le regole complete sono in [`AGENTS.md`](AGENTS.md).

### Generare il PDF della documentazione

Per ottenere un unico PDF con tutta la knowledge base:

```bash
npm run build:pdf
```

Il file viene scritto in `dist/`, con un nome del tipo:

```text
dist/knowledge-base-v0.2.0-2026-07-02.pdf
```

La versione (`v0.2.0`) è letta automaticamente dal frontmatter di [`knowledge/index.md`](knowledge/index.md).

Opzioni avanzate:

```bash
node scripts/build-knowledge-pdf.mjs --out ./mio-documento.pdf
node scripts/build-knowledge-pdf.mjs --root knowledge
```

**Nota:** la build PDF usa `@mermaid-js/mermaid-cli` per renderizzare i diagrammi Mermaid.
Al primo avvio può richiedere qualche minuto in più.

---

## Script npm disponibili

| Comando | Cosa fa |
|---|---|
| `npm test` | Valida la knowledge base (exit code ≠ 0 se ci sono errori) |
| `npm run test:strict` | Come `npm test`, ma fallisce anche sui warning |
| `npm run validate:kb` | Alias di `npm test` |
| `npm run build:pdf` | Genera il PDF della knowledge base in `dist/` |

**Non esistono** script come `npm run dev`, `npm start` o `npm run build` per un'applicazione: non c'è ancora codice applicativo nel repository.

---

## Contribuire alla documentazione

Se modifichi file in `knowledge/`:

1. Rispetta le convenzioni in [`AGENTS.md`](AGENTS.md) (un concetto per file, frontmatter YAML, link relativi con `./` e `.md`).
2. Aggiorna l'`index.md` della cartella se aggiungi un nuovo concetto.
3. Esegui `npm test` prima di aprire una pull request.
4. Leggi [`CONTRIBUTING.md`](CONTRIBUTING.md) per il flusso di lavoro completo.

---

## Risoluzione problemi

### `npm test` fallisce dopo le mie modifiche

Leggi l'output dello script: indica file e regola violata (frontmatter mancante, link rotto, voce assente in `index.md`, ecc.).
Consulta [`AGENTS.md`](AGENTS.md) per il dettaglio delle regole.

### `npm run build:pdf` è lento o fallisce sui diagrammi Mermaid

- Assicurati di aver eseguito `npm install`.
- Su Linux/CI a volte serve l'opzione `--no-sandbox` per Puppeteer: lo script la gestisce già internamente.
- I PNG dei diagrammi vengono messi in cache sotto `dist/.mermaid/`; le build successive sono più veloci.

### Non trovo `npm run dev`

È normale: **l'app non è ancora stata implementata**.
Segui le issue del repository o la community [Italian Builders](https://italianbuilders.co) per aggiornamenti sullo sviluppo dell'applicazione.

### Su Windows i comandi non partono

Usa **PowerShell** o **Git Bash** dalla cartella del progetto.
Se `node` non viene riconosciuto, reinstalla Node.js LTS e riapri il terminale.

---

## Prossimi passi

- Leggi la [visione e l'architettura proposta](README.md#architettura-proposta) nel README.
- Esplora la [knowledge base](knowledge/index.md) per capire modello dati, fonti e requisiti.
- Apri una [issue](https://github.com/Italian-Builders-Org/Italian-OSS-Legal-Platform/issues) se vuoi contribuire o hai domande.

Quando l'applicazione sarà disponibile, questa guida verrà aggiornata con le istruzioni per avviarla in locale.
