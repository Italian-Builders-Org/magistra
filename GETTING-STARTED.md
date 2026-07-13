# Inizia qui — Magistra

Questa guida raccoglie setup locale, avvio dell'app Electron, comandi npm e uso pratico della knowledge base.
Per stato del progetto, visione e architettura proposta, leggi il [`README.md`](README.md).

---

## Prerequisiti

- **[Node.js](https://nodejs.org/)** 20 LTS o superiore, con `npm`
- **[Git](https://git-scm.com/)** per clonare il repository
- Opzionale: **[Obsidian](https://obsidian.md/)** per navigare la knowledge base con grafo e link

Verifica l'ambiente:

```bash
node --version
npm --version
```

---

## Setup rapido

Clona il repository ed entra nella cartella del progetto:

```bash
git clone <url-del-repository>
cd magistra
```

Installa le dipendenze:

```bash
npm install
```

Avvia l'app desktop Electron in modalità sviluppo:

```bash
npm run dev
```

---

## Verifiche consigliate

Valida la knowledge base:

```bash
npm test
```

Esegui il typecheck di tutti i workspace:

```bash
npm run typecheck
```

Compila i workspace che espongono uno script di build:

```bash
npm run build
```

---

## Script npm disponibili

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Avvia l'app desktop Electron in modalità sviluppo |
| `npm run build` | Esegue la build dei workspace che hanno uno script `build` |
| `npm start` | Avvia la preview dell'app desktop |
| `npm run package` | Compila e prepara il packaging dell'app desktop |
| `npm run typecheck` | Esegue il typecheck dei workspace |
| `npm run lint` | Esegue ESLint sul repository |
| `npm run lint:fix` | Esegue ESLint applicando le correzioni automatiche |
| `npm run format` | Formatta il repository con Prettier |
| `npm run format:check` | Verifica la formattazione senza modificare i file |
| `npm test` | Valida la knowledge base |
| `npm run test:strict` | Valida la knowledge base fallendo anche sui warning |
| `npm run validate:kb` | Alias esplicito della validazione della knowledge base |
| `npm run build:pdf` | Genera il PDF della knowledge base in `dist/` |
| `npm run test:security` | Esegue i test di sicurezza dell'app desktop |

---

## Knowledge base

La knowledge base è in [`knowledge/`](knowledge/).
Ogni file Markdown descrive un solo concetto: una fonte, un'entità dati, un componente, un processo o un termine di glossario.

Punti di partenza consigliati:

- [`knowledge/index.md`](knowledge/index.md) — panoramica del bundle
- [`knowledge/fonti/index.md`](knowledge/fonti/index.md) — fonti normative
- [`knowledge/modello-dati/index.md`](knowledge/modello-dati/index.md) — modello dati e pipeline
- [`knowledge/architettura/index.md`](knowledge/architettura/index.md) — architettura proposta
- [`knowledge/glossario/index.md`](knowledge/glossario/index.md) — termini giuridici e tecnici

### Aprire la knowledge base in Obsidian

1. Installa [Obsidian](https://obsidian.md/).
2. Scegli **Open folder as vault**.
3. Seleziona la cartella **`knowledge/`**.

La configurazione del vault è versionata in `knowledge/.obsidian/`, quindi chi clona il repository ottiene la stessa configurazione di base.
Nella vista grafo puoi esplorare i collegamenti tra concetti.

### Validare la knowledge base

Prima di contribuire con modifiche alla documentazione, esegui:

```bash
npm test
```

Comandi equivalenti o più specifici:

```bash
npm run validate:kb
node scripts/validate-knowledge-base.mjs
```

Per fallire anche sui warning:

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

Il file viene scritto in `dist/`.
La versione è letta automaticamente dal frontmatter di [`knowledge/index.md`](knowledge/index.md).

Opzioni avanzate:

```bash
node scripts/build-knowledge-pdf.mjs --out ./mio-documento.pdf
node scripts/build-knowledge-pdf.mjs --root knowledge
```

La build PDF usa `@mermaid-js/mermaid-cli` per renderizzare i diagrammi Mermaid.
Al primo avvio può richiedere qualche minuto in più.

---

## Risoluzione problemi

### `npm run dev` non apre l'app Electron

Assicurati di aver eseguito `npm install`.
Se Electron viene eseguito come Node e l'app fallisce in avvio, prova a rimuovere la variabile d'ambiente `ELECTRON_RUN_AS_NODE` per quel comando:

```bash
env -u ELECTRON_RUN_AS_NODE npm run dev
```

### `npm test` fallisce dopo modifiche alla knowledge base

Leggi l'output dello script: indica file e regola violata.
Consulta [`AGENTS.md`](AGENTS.md) per il dettaglio delle regole.

### `npm run build:pdf` è lento o fallisce sui diagrammi Mermaid

- Assicurati di aver eseguito `npm install`.
- Su Linux/CI a volte serve l'opzione `--no-sandbox` per Puppeteer: lo script la gestisce internamente.
- I PNG dei diagrammi vengono messi in cache sotto `dist/.mermaid/`; le build successive sono più veloci.

### Su Windows i comandi non partono

Usa **PowerShell** o **Git Bash** dalla cartella del progetto.
Se `node` non viene riconosciuto, reinstalla Node.js LTS e riapri il terminale.

---

## Contribuire

Per modifiche alla knowledge base:

1. Rispetta le convenzioni in [`AGENTS.md`](AGENTS.md).
2. Aggiorna l'`index.md` della cartella se aggiungi un nuovo concetto.
3. Esegui `npm test`.

Per modifiche al codice:

1. Esegui `npm run typecheck`.
2. Esegui `npm run build` quando tocchi app, package o configurazione di build.
3. Leggi [`CONTRIBUTING.md`](CONTRIBUTING.md) per il flusso di lavoro completo.
