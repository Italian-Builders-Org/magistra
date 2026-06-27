// Shared helpers for the PGlite-vs-LanceDB scaling benchmark.
// The claim under test is INFRASTRUCTURE scaling (build time, RAM ceiling, query
// latency, on-disk size), NOT embedding recall quality. So synthetic normalized
// vectors at a realistic dimensionality are a faithful stand-in: an HNSW/IVF index
// stresses memory and CPU identically whether the floats are semantic or random.

export function now() {
  return Number(process.hrtime.bigint()) / 1e6; // ms
}

// Deterministic PRNG so runs are reproducible across machines.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One L2-normalized vector (cosine distance == 1 - dot for unit vectors).
export function randUnitVec(rnd, dim, out) {
  let ss = 0;
  for (let i = 0; i < dim; i++) {
    // Box-Muller -> roughly gaussian, so directions are uniform on the sphere.
    const u1 = Math.max(rnd(), 1e-12);
    const u2 = rnd();
    const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    out[i] = g;
    ss += g * g;
  }
  const inv = 1 / Math.sqrt(ss);
  for (let i = 0; i < dim; i++) out[i] *= inv;
  return out;
}

// pgvector text literal: '[0.1,0.2,...]'
export function toPgLiteral(vec) {
  // toFixed(6) keeps the string compact; precision is irrelevant for the test.
  let s = '[';
  for (let i = 0; i < vec.length; i++) {
    if (i) s += ',';
    s += vec[i].toFixed(6);
  }
  return s + ']';
}

export function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

// Samples process memory every `intervalMs` and remembers the peak of each field.
export class MemPeak {
  constructor(intervalMs = 100) {
    this.peak = { rss: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
    this.intervalMs = intervalMs;
    this._t = null;
  }
  _sample() {
    const m = process.memoryUsage();
    for (const k of Object.keys(this.peak)) {
      if (m[k] > this.peak[k]) this.peak[k] = m[k];
    }
  }
  start() {
    this._sample();
    this._t = setInterval(() => this._sample(), this.intervalMs);
    if (this._t.unref) this._t.unref();
  }
  stop() {
    this._sample();
    if (this._t) clearInterval(this._t);
    return this.mb();
  }
  mb() {
    const r = {};
    for (const k of Object.keys(this.peak)) r[k] = Math.round(this.peak[k] / 1048576);
    return r;
  }
}

export async function dirSizeBytes(dir) {
  const { readdir, stat } = await import('node:fs/promises');
  let total = 0;
  async function walk(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = d + '/' + e.name;
      if (e.isDirectory()) await walk(p);
      else {
        try {
          total += (await stat(p)).size;
        } catch {}
      }
    }
  }
  await walk(dir);
  return total;
}

export function mb(bytes) {
  return Math.round((bytes / 1048576) * 10) / 10;
}
