#!/usr/bin/env node
// Genera un singolo PDF con l'intera knowledge base OKF di
// Magistra.
//
// - Include TUTTI i file .md del bundle `knowledge/`.
// - I link interni `/cartella/file.md` diventano salti interni al PDF
//   (named destinations); le URL esterne restano cliccabili.
// - I file sono ordinati seguendo gli `index.md` (stesso ordine di lettura).
//
// Uso:
//   node scripts/build-knowledge-pdf.mjs [--root <dir>] [--out <file.pdf>]
//
// Dipendenze (pure-JS, nessun browser): pdfkit, marked.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { marked } from 'marked';

// --- Argomenti / percorsi ---------------------------------------------------

const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const bundleRoot = argVal('--root')
  ? path.resolve(argVal('--root'))
  : path.join(repoRoot, 'knowledge');
// Versione del documento: unica fonte di verità nel frontmatter di
// knowledge/index.md (campo `version`). La build la legge automaticamente,
// così non va mai scritta a mano nello script. La data è quella di generazione.
function readKbVersion() {
  try {
    const raw = fs.readFileSync(path.join(bundleRoot, 'index.md'), 'utf8').replace(/^﻿/, '');
    const { data } = splitFrontmatter(raw);
    return (typeof data.version === 'string' && data.version) || '0.0.0';
  } catch {
    return '0.0.0';
  }
}
const KB_VERSION = readKbVersion();
const GEN_DATE = new Date().toISOString().slice(0, 10);

const outPath = argVal('--out')
  ? path.resolve(argVal('--out'))
  : path.join(repoRoot, 'dist', `knowledge-base-v${KB_VERSION}-${GEN_DATE}.pdf`);

// --- Rendering Mermaid -> PNG (mermaid-cli, offline) ------------------------

const MMDC = path.join(
  repoRoot, 'node_modules', '.bin',
  process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc',
);
const mermaidCacheDir = path.join(path.dirname(outPath), '.mermaid');
let ppConfigPath = null;
let mermaidCount = 0;

// Chromium di sistema: evita il download Puppeteer (spesso incompleto in locale).
function resolveChromiumPath() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates = process.platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ]
    : [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
      ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch {
      // ignora path non leggibili
    }
  }
  return null;
}

function writePuppeteerConfig() {
  const cfg = { args: ['--no-sandbox'] };
  const chromium = resolveChromiumPath();
  if (chromium) {
    cfg.executablePath = chromium;
    console.log(`Mermaid: uso Chromium di sistema (${chromium})`);
  }
  ppConfigPath = path.join(mermaidCacheDir, 'puppeteer.json');
  fs.writeFileSync(ppConfigPath, JSON.stringify(cfg));
}

// Renderizza un blocco Mermaid in PNG (cache per hash del contenuto).
function renderMermaid(code) {
  fs.mkdirSync(mermaidCacheDir, { recursive: true });
  if (!ppConfigPath) {
    writePuppeteerConfig();
  }
  const hash = crypto.createHash('sha1').update(code).digest('hex').slice(0, 16);
  const png = path.join(mermaidCacheDir, `${hash}.png`);
  if (!fs.existsSync(png)) {
    const mmd = path.join(mermaidCacheDir, `${hash}.mmd`);
    fs.writeFileSync(mmd, code);
    execFileSync(
      MMDC,
      ['-i', mmd, '-o', png, '-b', 'white', '-s', '3', '-p', ppConfigPath],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
  }
  return png;
}

// --- Costanti di stile ------------------------------------------------------

const COLORS = {
  text: '#1f2933',
  muted: '#627d98',
  heading: '#102a43',
  link: '#0b69c7',
  rule: '#bcccdc',
  codeBg: '#f0f4f8',
  codeText: '#243b53',
  tableHeadBg: '#e4ecf5',
  tableBorder: '#bcccdc',
};
const FONT = {
  body: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
  boldItalic: 'Helvetica-BoldOblique',
  mono: 'Courier',
};
const SIZE = { body: 10.5, h1: 18, h2: 14, h3: 12, code: 9, small: 8 };
const LEADING = 1.35;
// Dimensione dei diagrammi Mermaid: leggermente rimpiccioliti per stare in
// pagina insieme al loro titolo. `widthFrac` riduce la larghezza (e quindi,
// proporzionalmente, l'altezza); `maxHeightFrac` è il tetto d'altezza come
// frazione dell'area utile di pagina.
const MERMAID = { widthFrac: 0.68, maxHeightFrac: 0.62 };

// Normalizzazione caratteri non rappresentabili dai font PDF standard (WinAnsi).
const TRANSLIT = {
  '─': '-', '│': '|', '┌': '+', '┐': '+', '└': '+', '┘': '+',
  '├': '+', '┤': '+', '┬': '+', '┴': '+', '┼': '+',
  '►': '>', '◄': '<', '▶': '>', '◀': '<', '▼': 'v', '▲': '^',
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>',
};
const TRANSLIT_RE = new RegExp('[' + Object.keys(TRANSLIT).join('') + ']', 'g');
const sanitize = (s) => String(s).replace(TRANSLIT_RE, (ch) => TRANSLIT[ch] ?? '?');

// --- Lettura del bundle -----------------------------------------------------

function listMarkdown(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMarkdown(full));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const bundlePathOf = (abs) =>
  '/' + path.relative(bundleRoot, abs).split(path.sep).join('/');

function splitFrontmatter(content) {
  const lines = content.split('\n');
  const data = {};
  let bodyStart = 0;
  if (lines[0]?.trim() === '---') {
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') { end = i; break; }
    }
    if (end !== -1) {
      for (let i = 1; i < end; i++) {
        const c = lines[i].indexOf(':');
        if (c === -1) continue;
        const k = lines[i].slice(0, c).trim();
        let v = lines[i].slice(c + 1).trim();
        if (v.startsWith('[') && v.endsWith(']')) {
          v = v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
        }
        data[k] = v;
      }
      bodyStart = end + 1;
    }
  }
  return { data, body: lines.slice(bodyStart).join('\n') };
}

// Estrae i target dei link Markdown interni (in ordine di apparizione).
function internalLinksInOrder(body, known) {
  const re = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const out = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    const p = m[1].split('#')[0];
    if (p.startsWith('/') && p.endsWith('.md') && known.has(p) && !out.includes(p)) {
      out.push(p);
    }
  }
  return out;
}

function loadBundle() {
  const files = listMarkdown(bundleRoot);
  const known = new Set(files.map(bundlePathOf));
  const byPath = new Map();
  for (const abs of files) {
    const bp = bundlePathOf(abs);
    const content = fs.readFileSync(abs, 'utf8').replace(/^﻿/, '');
    const { data, body } = splitFrontmatter(content);
    byPath.set(bp, { bp, abs, data, body, tokens: marked.lexer(body) });
  }

  // Ordine: radice → (per ogni index di cartella nell'ordine della radice)
  // l'index e poi i suoi concetti nell'ordine elencato. Restanti in coda.
  const order = [];
  const add = (bp) => { if (byPath.has(bp) && !order.includes(bp)) order.push(bp); };

  add('/index.md');
  const rootDoc = byPath.get('/index.md');
  const folderIndexes = rootDoc
    ? internalLinksInOrder(rootDoc.body, known).filter((p) => p.endsWith('/index.md'))
    : [];
  for (const fi of folderIndexes) {
    add(fi);
    const folder = fi.replace(/index\.md$/, '');
    for (const c of internalLinksInOrder(byPath.get(fi).body, known)) {
      if (c.startsWith(folder) && c !== fi) add(c);
    }
  }
  for (const bp of [...known].sort()) add(bp); // completezza

  return { byPath, known, order };
}

// --- Costruzione dei "run" inline da token marked ---------------------------

function pickFont(style) {
  if (style.code) return FONT.mono;
  if (style.bold && style.italic) return FONT.boldItalic;
  if (style.bold) return FONT.bold;
  if (style.italic) return FONT.italic;
  return FONT.body;
}

function resolveTarget(href, known) {
  const [p] = href.split('#');
  if (/^(https?:|mailto:)/i.test(href)) return { link: href };
  if (p.startsWith('/') && p.endsWith('.md') && known.has(p)) return { goTo: p };
  if (/^[a-z]+:/i.test(href)) return { link: href };
  return {};
}

function buildRuns(tokens, known, style = {}, runs = []) {
  for (const t of tokens) {
    switch (t.type) {
      case 'text':
      case 'escape':
        if (t.tokens) buildRuns(t.tokens, known, style, runs);
        else runs.push({ text: sanitize(t.text), style: { ...style } });
        break;
      case 'strong':
        buildRuns(t.tokens, known, { ...style, bold: true }, runs);
        break;
      case 'em':
        buildRuns(t.tokens, known, { ...style, italic: true }, runs);
        break;
      case 'del':
        buildRuns(t.tokens, known, style, runs);
        break;
      case 'codespan':
        runs.push({ text: sanitize(t.text), style: { ...style, code: true } });
        break;
      case 'br':
        runs.push({ text: '\n', style: { ...style } });
        break;
      case 'link': {
        const target = resolveTarget(t.href, known);
        buildRuns(t.tokens, known, { ...style, ...target, linkish: true }, runs);
        break;
      }
      default:
        if (t.tokens) buildRuns(t.tokens, known, style, runs);
        else if (t.text != null) runs.push({ text: sanitize(t.text), style: { ...style } });
    }
  }
  return runs;
}

function plainText(tokens) {
  let s = '';
  for (const t of tokens) {
    if (t.type === 'codespan' || t.type === 'escape') s += t.text;
    else if (t.tokens) s += plainText(t.tokens);
    else if (t.text != null) s += t.text;
  }
  return sanitize(s);
}

// --- Generazione del PDF ----------------------------------------------------

function build() {
  const { byPath, known, order } = loadBundle();

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 64, left: 60, right: 60 },
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: `Magistra — Knowledge base v${KB_VERSION} (${GEN_DATE})`,
      Author: 'Magistra',
      Subject: 'Bundle Open Knowledge Format (OKF)',
    },
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const M = doc.page?.margins ?? { top: 60, bottom: 64, left: 60, right: 60 };
  // `left`/`contentW` sono mutabili: il blockquote li sposta temporaneamente
  // per indentare il proprio contenuto (e li ripristina dopo).
  let left = 60;
  doc.addPage();
  let contentW = doc.page.width - 60 - 60;
  const bottomY = () => doc.page.height - 64;

  const ensure = (h) => { if (doc.y + h > bottomY()) doc.addPage(); };

  // Scrive una sequenza di run inline a partire da (x, y) entro `width`.
  function writeRuns(runs, x, y, width) {
    if (runs.length === 0) { doc.x = x; return; }
    let first = true;
    runs.forEach((r, i) => {
      const last = i === runs.length - 1;
      doc.font(pickFont(r.style)).fontSize(SIZE.body);
      const color = r.style.linkish
        ? COLORS.link
        : r.style.code
          ? COLORS.codeText
          : COLORS.text;
      doc.fillColor(color);
      const opts = {
        continued: !last,
        lineGap: SIZE.body * (LEADING - 1),
        underline: !!r.style.linkish, // esplicito: evita che la sottolineatura "sbordi"
        link: r.style.link ?? null,
        goTo: r.style.goTo ?? null,
      };
      if (first) { doc.text(r.text, x, y, { ...opts, width }); first = false; }
      else doc.text(r.text, opts);
    });
    doc.fillColor(COLORS.text);
  }

  function paragraph(tokens) {
    const runs = buildRuns(tokens, known);
    ensure(SIZE.body * LEADING);
    writeRuns(runs, left, doc.y, contentW);
    doc.moveDown(0.6);
  }

  function heading(t, isSectionTitle, dest) {
    const size = t.depth === 1 ? SIZE.h1 : t.depth === 2 ? SIZE.h2 : SIZE.h3;
    ensure(size * 1.8 + 6);
    doc.moveDown(t.depth === 1 ? 0.2 : 0.5);
    if (dest) doc.addNamedDestination(dest);
    const runs = buildRuns(t.tokens, known);
    let first = true;
    runs.forEach((r, i) => {
      const last = i === runs.length - 1;
      // I titoli sono sempre in grassetto, mai monospace (anche se contengono `code`).
      doc.font(FONT.bold).fontSize(size).fillColor(COLORS.heading);
      const o = { continued: !last };
      if (first) { doc.text(r.text, left, doc.y, { ...o, width: contentW }); first = false; }
      else doc.text(r.text, o);
    });
    if (isSectionTitle) {
      doc.moveDown(0.25);
      doc.strokeColor(COLORS.rule).lineWidth(1)
        .moveTo(left, doc.y).lineTo(left + contentW, doc.y).stroke();
    }
    doc.moveDown(t.depth === 1 ? 0.6 : 0.35);
    doc.fillColor(COLORS.text);
  }

  function mermaidBlock(t) {
    const png = renderMermaid(t.text); // NB: niente sanitize, Mermaid usa font reali
    const img = doc.openImage(png);
    // Parti dalla larghezza disponibile (mai ingrandire) e rimpicciolisci un po'.
    let w = Math.min(contentW, img.width) * MERMAID.widthFrac;
    let h = img.height * (w / img.width);
    const maxH = (doc.page.height - M.top - 64) * MERMAID.maxHeightFrac;
    if (h > maxH) { const f = maxH / h; w *= f; h *= f; }
    if (doc.y + h > bottomY()) doc.addPage();
    doc.moveDown(0.2);
    doc.image(png, left + (contentW - w) / 2, doc.y, { width: w });
    doc.y += h;
    doc.moveDown(0.6);
    mermaidCount++;
  }

  function codeBlock(t) {
    if ((t.lang || '').toLowerCase() === 'mermaid') {
      try {
        mermaidBlock(t);
        return;
      } catch (err) {
        const msg = (err && err.message ? err.message : String(err)).split('\n')[0];
        console.warn(`⚠ Render Mermaid fallito, mostro il codice sorgente. ${msg}`);
        // prosegue mostrando il blocco come codice
      }
    }
    const raw = sanitize(t.text.replace(/\n+$/, ''));
    const lines = raw.split('\n');
    const pad = 8;
    // Riduci il font se una riga è troppo larga, per non spezzare i diagrammi.
    let size = SIZE.code;
    doc.font(FONT.mono);
    const widest = Math.max(...lines.map((l) => doc.fontSize(SIZE.code).widthOfString(l || ' ')));
    if (widest > contentW - 2 * pad) {
      size = Math.max(6, SIZE.code * (contentW - 2 * pad) / widest);
    }
    const lineH = size * 1.25;
    const blockH = lines.length * lineH + 2 * pad;

    if (blockH <= bottomY() - M.top && doc.y + blockH > bottomY()) doc.addPage();

    const startY = doc.y;
    if (blockH <= bottomY() - doc.y) {
      doc.save().rect(left, startY, contentW, blockH).fill(COLORS.codeBg).restore();
    }
    doc.font(FONT.mono).fontSize(size).fillColor(COLORS.codeText);
    let y = startY + pad;
    for (const l of lines) {
      if (y + lineH > bottomY()) { doc.addPage(); y = doc.y; }
      doc.text(l || ' ', left + pad, y, { lineBreak: false, width: contentW - 2 * pad });
      y += lineH;
    }
    doc.y = y + pad;
    doc.fillColor(COLORS.text);
  }

  function list(t, depth = 0) {
    const indent = left + depth * 16;
    let n = typeof t.start === 'number' ? t.start : 1;
    for (const item of t.items) {
      const marker = t.ordered ? `${n++}.` : '•';
      const inline = [];
      const sublists = [];
      for (const child of item.tokens) {
        if (child.type === 'list') sublists.push(child);
        else if (child.tokens) inline.push(...child.tokens);
        else if (child.text != null) inline.push({ type: 'text', text: child.text });
      }
      ensure(SIZE.body * LEADING);
      const y0 = doc.y;
      doc.font(FONT.body).fontSize(SIZE.body).fillColor(COLORS.muted);
      doc.text(marker, indent, y0, { width: 14, lineBreak: false });
      writeRuns(buildRuns(inline, known), indent + 16, y0, contentW - (indent + 16 - left));
      doc.moveDown(0.2);
      for (const sub of sublists) list(sub, depth + 1);
    }
    doc.moveDown(0.3);
  }

  function blockquote(t) {
    doc.moveDown(0.1);
    const barX = left + 3;          // posizione della barra (margine originale)
    const startY = doc.y;
    const savedLeft = left;
    const savedContentW = contentW;
    // Indenta davvero il contenuto spostando il margine usato da tutte le
    // funzioni di rendering interne; ripristina prima di disegnare la barra.
    left = savedLeft + 18;
    contentW = savedContentW - 18;
    renderBlocks(t.tokens);
    left = savedLeft;
    contentW = savedContentW;
    doc.save().strokeColor(COLORS.rule).lineWidth(3)
      .moveTo(barX, startY).lineTo(barX, doc.y).stroke().restore();
    doc.moveDown(0.3);
  }

  function table(t) {
    const cols = t.header.length;
    const pad = 5;
    doc.fontSize(SIZE.body);
    const natural = t.header.map((h, ci) => {
      doc.font(FONT.bold);
      let w = doc.widthOfString(plainText(h.tokens)) + 2 * pad;
      doc.font(FONT.body);
      for (const row of t.rows) {
        w = Math.max(w, doc.widthOfString(plainText(row[ci].tokens)) + 2 * pad);
      }
      return w;
    });
    const totalNat = natural.reduce((a, b) => a + b, 0);
    const scale = contentW / totalNat;
    const widths = natural.map((w) => w * scale);

    const rowHeight = (cells) => {
      doc.font(FONT.body).fontSize(SIZE.body);
      let h = 0;
      cells.forEach((c, ci) => {
        h = Math.max(h, doc.heightOfString(plainText(c.tokens), { width: widths[ci] - 2 * pad }));
      });
      return h + 2 * pad;
    };

    const drawRow = (cells, isHeader) => {
      const h = rowHeight(cells);
      if (doc.y + h > bottomY()) { doc.addPage(); }
      const y = doc.y;
      let x = left;
      cells.forEach((c, ci) => {
        const w = widths[ci];
        if (isHeader) doc.save().rect(x, y, w, h).fill(COLORS.tableHeadBg).restore();
        doc.save().strokeColor(COLORS.tableBorder).lineWidth(0.75).rect(x, y, w, h).stroke().restore();
        const runs = buildRuns(c.tokens, known);
        if (isHeader) runs.forEach((r) => (r.style.bold = true));
        writeRuns(runs, x + pad, y + pad, w - 2 * pad);
        x += w;
      });
      doc.y = y + h;
    };

    ensure(rowHeight(t.header) + 4);
    drawRow(t.header, true);
    for (const row of t.rows) drawRow(row, false);
    doc.moveDown(0.6);
    doc.x = left;
  }

  function renderBlocks(tokens, blockLeft = left, blockWidth = contentW) {
    // blockLeft/blockWidth usati solo dal blockquote; per gli altri si usa `left`.
    void blockLeft; void blockWidth;
    for (const t of tokens) {
      switch (t.type) {
        case 'heading': heading(t, false); break;
        case 'paragraph': paragraph(t.tokens); break;
        case 'text': if (t.tokens) paragraph(t.tokens); else paragraph([{ type: 'text', text: t.text }]); break;
        case 'code': codeBlock(t); break;
        case 'list': list(t); break;
        case 'blockquote': blockquote(t); break;
        case 'table': table(t); break;
        case 'hr':
          ensure(12); doc.moveDown(0.3);
          doc.strokeColor(COLORS.rule).lineWidth(1)
            .moveTo(left, doc.y).lineTo(left + contentW, doc.y).stroke();
          doc.moveDown(0.5);
          break;
        case 'space': doc.moveDown(0.3); break;
        case 'html': break; // ignorato
        default: if (t.tokens) renderBlocks(t.tokens);
      }
    }
  }

  // ---- Copertina ----
  doc.moveDown(6);
  doc.font(FONT.bold).fontSize(30).fillColor(COLORS.heading)
    .text('Magistra', left, doc.y, { width: contentW });
  doc.moveDown(0.4);
  doc.font(FONT.body).fontSize(14).fillColor(COLORS.text)
    .text('Knowledge base — bundle Open Knowledge Format (OKF)', { width: contentW });
  doc.moveDown(0.6);
  doc.font(FONT.bold).fontSize(13).fillColor(COLORS.text)
    .text(`Versione ${KB_VERSION}`, { width: contentW });
  doc.moveDown(0.25);
  doc.font(FONT.body).fontSize(SIZE.body).fillColor(COLORS.muted).text(
    `Generato il ${GEN_DATE} · ${order.length} documenti`,
    { width: contentW },
  );
  doc.fillColor(COLORS.text);

  // ---- Indice (sommario) cliccabile ----
  doc.addPage();
  heading({ depth: 1, tokens: [{ type: 'text', text: 'Indice' }] }, true, '/_toc');
  for (const bp of order) {
    const d = byPath.get(bp);
    const isFolderIndex = bp.endsWith('/index.md') && bp !== '/index.md';
    const isConcept = !bp.endsWith('index.md');
    const title = (typeof d.data.title === 'string' && d.data.title) || bp;
    const indent = isConcept ? left + 18 : left;
    ensure(SIZE.body * 1.4);
    doc.font(isFolderIndex ? FONT.bold : FONT.body).fontSize(SIZE.body)
      .fillColor(COLORS.link)
      .text(sanitize(title), indent, doc.y, {
        width: contentW - (indent - left), goTo: bp, underline: false, lineGap: 3,
      });
  }
  doc.fillColor(COLORS.text);

  // ---- Sezioni ----
  // Ogni documento ha un solo H1 (il "titolo principale"): lo facciamo iniziare
  // sempre su una pagina nuova, così ogni concetto ha la sua pagina dedicata.
  for (const bp of order) {
    const d = byPath.get(bp);
    doc.addPage();

    let titled = false;
    for (const t of d.tokens) {
      if (t.type === 'heading' && t.depth === 1 && !titled) {
        heading(t, true, bp); // destinazione = percorso del file
        titled = true;
      } else {
        renderBlocks([t]);
      }
    }
    if (!titled) doc.addNamedDestination(bp); // fallback se manca l'H1
  }

  // ---- Footer con numero di pagina ----
  // Si scrive nell'area del margine inferiore: azzeriamo temporaneamente
  // margins.bottom, altrimenti pdfkit aggiungerebbe una pagina vuota a ogni footer.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font(FONT.body).fontSize(SIZE.small).fillColor(COLORS.muted);
    doc.text(
      `Magistra · Knowledge base OKF · Pag. ${i + 1}/${range.count}`,
      left, doc.page.height - 44,
      { width: contentW, align: 'center', lineBreak: false },
    );
    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
  return new Promise((res, rej) => {
    stream.on('finish', res);
    stream.on('error', rej);
  });
}

build()
  .then(() => {
    const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(
      `✓ PDF generato: ${path.relative(repoRoot, outPath)} (${kb} KB)` +
      `${mermaidCount ? ` · ${mermaidCount} diagrammi Mermaid` : ''}`,
    );
  })
  .catch((e) => {
    console.error('✗ Errore nella generazione del PDF:', e);
    process.exit(1);
  });
