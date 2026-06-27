// Sweep runner for both engines. Each (engine, N) runs in an isolated child
// process; the data dir is deleted before and after every run so the (often
// RAM-backed) temp filesystem never accumulates and fills up. Results are written
// after every run to results.json + REPORT.md, so a late crash never loses the
// data points already collected.
//
// Configurable via env:
//   DIM=1024  PGLITE_N=10000,50000,100000,250000  LANCE_N=...,1000000  TIMEOUT_S=3600
import { spawn } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';

const DIM = Number(process.env.DIM ?? 1024);
const SWEEP = {
  pglite: (process.env.PGLITE_N ?? '10000,50000,100000,250000').split(',').map(Number),
  lancedb: (process.env.LANCE_N ?? '10000,50000,100000,250000,500000,1000000').split(',').map(Number),
};
const TIMEOUT_MS = Number(process.env.TIMEOUT_S ?? 3600) * 1000;

const results = [];

function runOne(engine, n) {
  return new Promise((resolve) => {
    const script = `bench-${engine}.mjs`;
    const started = Date.now();
    const child = spawn('node', [script, '--n', String(n), '--dim', String(DIM)], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
    });
    let out = '';
    let killed = false;
    const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      const wall = Math.round((Date.now() - started) / 1000);
      const line = out.split('\n').find((l) => l.startsWith('RESULT:'));
      const r = line ? JSON.parse(line.slice(7)) : {
        engine, n, dim: DIM, ok: false,
        phase: killed ? 'timeout' : 'crash',
        error: (killed
          ? `killed after ${TIMEOUT_MS / 1000}s`
          : `exit ${code}: ` + out.trim().split('\n').slice(-2).join(' | ')).slice(0, 200),
        insert_ms: null, index_build_ms: null, q_p95_ms: null,
        q_filtered_p95_ms: null, disk_mb: null, peak_mb: null,
      };
      r.wall_s = wall;
      resolve(r);
    });
  });
}

const cell = (v) => (v === null || v === undefined ? 'n/d' : v);
const rss = (r) => (r.peak_mb && r.peak_mb.rss != null ? r.peak_mb.rss : 'n/d');

async function writeReport() {
  const rows = results.map((r) =>
    `| ${r.engine} | ${r.n.toLocaleString('it-IT')} | ${r.ok ? 'ok' : r.phase.toUpperCase()} | ` +
    `${cell(r.index_build_ms)} | ${cell(r.q_p95_ms)} | ${cell(r.q_filtered_p95_ms)} | ` +
    `${cell(r.disk_mb)} | ${rss(r)} | ${cell(r.wall_s)} |`
  );
  const md = `# Risultati: indice normativo (scala)

Dim ${DIM}, float32 L2-normalizzati (sintetici). HNSW pgvector (m=16, ef_construction=64,
ef_search=40) vs LanceDB IVF_PQ, distanza coseno. Ogni run è un processo isolato.

| motore | N | esito | build ms | query p95 ms | query filtrata p95 ms | disco MB | peak RSS MB | wall s |
|---|---:|---|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

_Il peak RSS è solo indicativo: include V8/JS oltre all'heap WASM ed è rumoroso. Le
metriche di riferimento sono build, latenza e disco._
`;
  await writeFile('REPORT.md', md);
  await writeFile('results.json', JSON.stringify(results, null, 2));
}

for (const engine of ['pglite', 'lancedb']) {
  for (const n of SWEEP[engine]) {
    process.stderr.write(`\n>>> ${engine} N=${n} ...\n`);
    const dir = `./data/${engine}-${n}`;
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    const r = await runOne(engine, n);
    results.push(r);
    await writeReport();
    await rm(dir, { recursive: true, force: true }).catch(() => {}); // free the temp fs immediately
    process.stderr.write(
      `    ${r.ok ? 'OK' : 'FAIL:' + r.phase} (${r.wall_s}s) build=${cell(r.index_build_ms)}ms ` +
      `q_p95=${cell(r.q_p95_ms)}ms disk=${cell(r.disk_mb)}MB\n`
    );
  }
}

process.stderr.write('\nDONE. See REPORT.md\n');
