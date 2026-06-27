// One LanceDB run at a fixed N, same metrics as bench-pglite.mjs for a fair
// head-to-head. LanceDB is a native (Rust) embedded store with on-disk ANN, so it
// is not bound by wasm32's address space. Usage mirrors bench-pglite.mjs.
import { rm } from 'node:fs/promises';
import {
  now, mulberry32, randUnitVec, percentile, MemPeak, dirSizeBytes, mb,
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
const DATADIR = A.datadir || `./data/lancedb-${N}`;
const QUERIES = 30;
const TOPK = 10;
const ADD_BATCH = 50000;

const result = {
  engine: 'lancedb', n: N, dim: DIM, mode: 'disk',
  ok: false, phase: 'init', error: null,
  insert_ms: null, index_build_ms: null,
  q_p50_ms: null, q_p95_ms: null, q_filtered_p95_ms: null,
  disk_mb: null, peak_mb: null,
};
const mem = new MemPeak();
mem.start();

try {
  const lancedb = await import('@lancedb/lancedb');
  await rm(DATADIR, { recursive: true, force: true }).catch(() => {});
  const db = await lancedb.connect(DATADIR);

  // ---- insert ----
  result.phase = 'insert';
  const rnd = mulberry32(12345);
  let t = now();

  function makeBatch(start, count) {
    const rows = new Array(count);
    const buf = new Float32Array(DIM);
    for (let j = 0; j < count; j++) {
      randUnitVec(rnd, DIM, buf);
      rows[j] = { id: start + j, tipo: (start + j) % 10, vector: Array.from(buf) };
    }
    return rows;
  }

  let tbl;
  const first = makeBatch(0, Math.min(ADD_BATCH, N));
  tbl = await db.createTable('items', first);
  for (let off = first.length; off < N; off += ADD_BATCH) {
    const count = Math.min(ADD_BATCH, N - off);
    await tbl.add(makeBatch(off, count));
  }
  result.insert_ms = Math.round(now() - t);

  // ---- index build (IVF_PQ; partitions scaled to dataset) ----
  result.phase = 'index_build';
  t = now();
  const partitions = Math.max(1, Math.min(4096, Math.round(Math.sqrt(N))));
  try {
    await tbl.createIndex('vector', {
      config: lancedb.Index.ivfPq({ numPartitions: partitions, distanceType: 'cosine' }),
    });
  } catch (e) {
    // Small N may lack rows to train; fall back to brute-force (still valid).
    result.error = 'index_fallback_bruteforce: ' + (e.message || '').slice(0, 120);
  }
  result.index_build_ms = Math.round(now() - t);

  // ---- query ----
  result.phase = 'query';
  const qrnd = mulberry32(999);
  const buf = new Float32Array(DIM);
  const lat = [];
  for (let q = 0; q < QUERIES; q++) {
    randUnitVec(qrnd, DIM, buf);
    const t0 = now();
    await tbl.search(Array.from(buf)).limit(TOPK).toArray();
    lat.push(now() - t0);
  }
  lat.sort((a, b) => a - b);
  result.q_p50_ms = Math.round(percentile(lat, 50) * 100) / 100;
  result.q_p95_ms = Math.round(percentile(lat, 95) * 100) / 100;

  const flat = [];
  for (let q = 0; q < QUERIES; q++) {
    randUnitVec(qrnd, DIM, buf);
    const t0 = now();
    await tbl.search(Array.from(buf)).where(`tipo = ${q % 10}`).limit(TOPK).toArray();
    flat.push(now() - t0);
  }
  flat.sort((a, b) => a - b);
  result.q_filtered_p95_ms = Math.round(percentile(flat, 95) * 100) / 100;

  result.disk_mb = mb(await dirSizeBytes(DATADIR));
  result.ok = true;
  result.phase = 'done';
} catch (e) {
  result.error = (result.error ? result.error + ' | ' : '') +
    (e && e.message ? e.message : String(e)).slice(0, 300);
}
result.peak_mb = mem.stop();
console.log('RESULT:' + JSON.stringify(result));
process.exit(0);
