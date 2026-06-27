// One PGlite+pgvector run at a fixed N. Prints a single JSON line of metrics on
// stdout (prefixed RESULT:) and exits. Designed to be spawned as a child process
// so a wasm OOM/abort is captured as a data point instead of killing the sweep.
//
// Usage: node bench-pglite.mjs --n 100000 --dim 1024 --datadir /path [--memory]
import { rm } from 'node:fs/promises';
import {
  now, mulberry32, randUnitVec, toPgLiteral, percentile, MemPeak, dirSizeBytes, mb,
} from './lib.mjs';

function parseArgs() {
  const a = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { a[key] = next; i++; }
      else a[key] = true;
    }
  }
  return a;
}
const A = parseArgs();
const N = parseInt(A.n || '100000', 10);
const DIM = parseInt(A.dim || '1024', 10);
const DATADIR = A.datadir || `./data/pglite-${N}`;
const INMEM = !!A.memory;
const QUERIES = 30;
const TOPK = 10;

const result = {
  engine: 'pglite', n: N, dim: DIM, mode: INMEM ? 'memory' : 'disk',
  ok: false, phase: 'init', error: null,
  insert_ms: null, index_build_ms: null,
  q_p50_ms: null, q_p95_ms: null, q_filtered_p95_ms: null,
  disk_mb: null, peak_mb: null,
};
const mem = new MemPeak();
mem.start();

try {
  const { PGlite } = await import('@electric-sql/pglite');
  const { vector } = await import('@electric-sql/pglite-pgvector');

  if (!INMEM) await rm(DATADIR, { recursive: true, force: true }).catch(() => {});
  const db = INMEM
    ? new PGlite({ extensions: { vector } })
    : new PGlite(DATADIR, { extensions: { vector } });
  await db.waitReady;
  await db.exec('CREATE EXTENSION IF NOT EXISTS vector;');
  await db.exec(`CREATE TABLE items (id int PRIMARY KEY, tipo int, embedding vector(${DIM}));`);

  // Give the HNSW builder as much room as we can; wasm32 will cap this in practice.
  await db.exec(`SET maintenance_work_mem = '1GB';`);

  // ---- insert (via COPY FROM /dev/blob, the realistic bulk path) ----
  result.phase = 'insert';
  const rnd = mulberry32(12345);
  const buf = new Float32Array(DIM);
  let t = now();
  const COPY_CHUNK = 25000; // rows per blob, to bound the in-JS string size
  let lines = [];
  async function copyChunk() {
    if (lines.length === 0) return;
    const blob = new Blob([lines.join('')], { type: 'text/csv' });
    await db.query(`COPY items FROM '/dev/blob' WITH (FORMAT csv);`, [], { blob });
    lines = [];
  }
  for (let i = 0; i < N; i++) {
    randUnitVec(rnd, DIM, buf);
    // CSV: embedding literal must be quoted because it contains commas.
    lines.push(`${i},${i % 10},"${toPgLiteral(buf)}"\n`);
    if (lines.length >= COPY_CHUNK) await copyChunk();
  }
  await copyChunk();
  result.insert_ms = Math.round(now() - t);

  // ---- HNSW index build ----
  result.phase = 'index_build';
  t = now();
  await db.exec(
    `CREATE INDEX items_emb_idx ON items USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);`
  );
  result.index_build_ms = Math.round(now() - t);

  // ---- query ----
  result.phase = 'query';
  await db.exec(`SET hnsw.ef_search = 40;`);
  const qrnd = mulberry32(999);
  const lat = [];
  for (let q = 0; q < QUERIES; q++) {
    randUnitVec(qrnd, DIM, buf);
    const lit = toPgLiteral(buf);
    const t0 = now();
    await db.query(`SELECT id FROM items ORDER BY embedding <=> $1 LIMIT ${TOPK};`, [lit]);
    lat.push(now() - t0);
  }
  lat.sort((a, b) => a - b);
  result.q_p50_ms = Math.round(percentile(lat, 50) * 100) / 100;
  result.q_p95_ms = Math.round(percentile(lat, 95) * 100) / 100;

  // metadata-filtered ANN (mirrors filtering by vigenza/tipo_atto in real use)
  const flat = [];
  for (let q = 0; q < QUERIES; q++) {
    randUnitVec(qrnd, DIM, buf);
    const lit = toPgLiteral(buf);
    const t0 = now();
    await db.query(
      `SELECT id FROM items WHERE tipo = $2 ORDER BY embedding <=> $1 LIMIT ${TOPK};`,
      [lit, q % 10]
    );
    flat.push(now() - t0);
  }
  flat.sort((a, b) => a - b);
  result.q_filtered_p95_ms = Math.round(percentile(flat, 95) * 100) / 100;

  if (!INMEM) {
    await db.close?.();
    result.disk_mb = mb(await dirSizeBytes(DATADIR));
  }
  result.ok = true;
  result.phase = 'done';
} catch (e) {
  result.error = (e && e.message ? e.message : String(e)).slice(0, 300);
}
result.peak_mb = mem.stop();
console.log('RESULT:' + JSON.stringify(result));
process.exit(result.ok ? 0 : 0); // always 0; the runner reads RESULT line
