# Benchmark: scala dell'indice normativo

Questo benchmark non sceglie un motore. Misura un comportamento e serve ad alimentare la discussione aperta su [#13](https://github.com/Italian-Builders-Org/magistra/issues/13), [#15](https://github.com/Italian-Builders-Org/magistra/issues/15) e [#27](https://github.com/Italian-Builders-Org/magistra/issues/27).

## La domanda

L'architettura propone un unico PGlite (Postgres compilato in WASM) con pgvector, condiviso tra database applicativo e indice normativo vettoriale, impacchettato nell'app desktop. La domanda è se un indice vettoriale dentro WASM-Postgres regga la scala del corpus normativo sulla macchina di un utente.

Il corpus statale è dell'ordine di 110.000 atti vigenti e ~204.000 totali ([Il Sole 24 Ore](https://www.ilsole24ore.com/art/nell-italia-110mila-leggi-ancora-validi-33mila-regi-decreti-AEEWNJj)). Con il chunking per unità (articolo/comma) e la multivigenza, un sottoinsieme da MVP è plausibilmente nell'ordine di 10^5-10^6 chunk, il corpus pieno milioni.

## Cosa misura

Qui si misura la scala infrastrutturale: tempo di costruzione dell'indice, latenza di query, memoria, dimensione su disco. Non si misura la qualità del recupero. Per questo i vettori sono sintetici (1024-dim, float32, L2-normalizzati, PRNG deterministico): per la costruzione e la latenza di un indice ANN un vettore casuale stressa la struttura come uno reale. La recall è un'altra domanda, va fatta con dati veri, e qui non c'è.

Sotto esame c'è PGlite con pgvector, indice HNSW (`m=16`, `ef_construction=64`, `ef_search=40`, distanza coseno). Come riferimento uso un motore embedded nativo su disco (LanceDB, IVF_PQ, coseno): serve solo a mostrare che lo stesso carico sulla stessa macchina è trattabile da un motore non-WASM, così da isolare la causa nel motore e non nel volume di dati. Non è una proposta: altri candidati nativi come sqlite-vec o DuckDB-VSS non sono stati misurati.

## Come eseguire

```bash
npm install
node bench-pglite.mjs  --n 100000 --dim 1024   # una misura PGlite
node bench-lancedb.mjs --n 100000 --dim 1024   # una misura di riferimento
node run.mjs                                   # sweep di entrambi, pulisce il disco tra le run
```

Ogni run gira in un processo isolato e stampa una riga `RESULT:{…}` in JSON.

## Risultati

1024-dim, host 24 core / 30 GB RAM. La macchina è sovradimensionata rispetto a un laptop, di proposito: non aiuta PGlite, perché il tetto di wasm32 (sotto) è indipendente dall'host e i tempi di build sono già fuori scala su hardware abbondante.

| N (chunk) | PGlite build | PGlite query p95 | PGlite query filtrata p95 | PGlite disco | rif. build | rif. query p95 | rif. disco |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10.000  | 16,6 s  | 3,1 ms  | 7,3 ms   | 250 MB | 2,1 s  | 4,8 ms | 41 MB |
| 50.000  | 114 s   | 9,1 ms  | 28,7 ms  | 1,1 GB | 14,5 s | 5,1 ms | 201 MB |
| 100.000 | 282 s   | 18 ms   | 74 ms    | 2,2 GB | 20 s   | 5,1 ms | 401 MB |
| 250.000 | 1057 s (~17,6 min) | 17,6 ms | 431 ms | 4,3 GB | 23 s | 6,5 ms | 1,0 GB |
| 500.000 | non eseguito | n/d | n/d | n/d | 40 s | 6,3 ms | 2,0 GB |
| 1.000.000 | non eseguito | n/d | n/d | n/d | 67 s | 8,9 ms | 4,0 GB |

PGlite non è stato spinto oltre 250.000 chunk: a quella scala la costruzione dell'indice è già di circa 17 minuti, ed è ancora sotto la scala di un MVP. Il motore di riferimento è stato portato fino a 1M solo per mostrare che il carico ha margine.

La costruzione dell'indice HNSW in PGlite cresce in modo circa quadratico (16,6 → 114 → 282 → 1057 s), mentre il riferimento resta piatto (2 → 67 s fino a 1M). A 250.000 chunk PGlite impiega circa 17 minuti per costruire un indice che il riferimento fa in 23 secondi. Le query con filtro sui metadati, che qui servono per natura (vigenza, tipo atto), degradano a 431 ms in PGlite contro i ~7 ms del riferimento, e la forbice si allarga con N.

## Come leggere i numeri

Ci sono due piani, e conviene non confonderli.

Il primo è quello misurato qui, ed è indipendente dai bit: pgvector dentro la sandbox WASM è lento per un indice vettoriale ad alto costo, sia a 32 sia a 64 bit. Questo da solo basta a rispondere alla domanda.

Il secondo è strutturale e documentato, ma in questo benchmark non viene raggiunto: wasm32 indirizza una singola memoria lineare con indici a 32 bit, quindi al massimo 2^32 byte, 4 GiB (i motori di default si fermano a 2 GiB salvo opt-in). Vedi [V8](https://v8.dev/blog/4gb-wasm-memory) e la [proposta memory64](https://github.com/WebAssembly/memory64/blob/main/proposals/memory64/Overview.md). A corpus pieno (milioni di chunk per 1024-dim più il grafo HNSW, decine di GB) l'indice non entra nello spazio di indirizzamento. È un'estrapolazione dai documenti, non un dato di queste run, che invece completano.

Sul "e memory64?": memory64 esiste (WebAssembly 3.0, 2025) e un Electron recente lo supporta a livello di motore, ma è un target di compilazione del modulo `.wasm` (`-s MEMORY64=1`), non un interruttore lato Electron. PGlite oggi distribuisce un build wasm32 e gestisce la memoria via OPFS, non con memory64. E anche ricompilandolo, memory64 alzerebbe solo il tetto di memoria, non i tempi di costruzione né le query filtrate, e aggiungerebbe un 10-15% di costo ([loke.dev](https://loke.dev/blog/wasm-64-bit-memory-limit-wasm64)). Risponde al secondo piano, non al primo. L'asse vero non è 32 contro 64 bit, è motore embedded nativo contro Postgres in sandbox WASM.

## Limiti

- Vettori sintetici: misurano memoria, latenza e build, non la recall. Quella va testata a parte con dati reali.
- Host non-laptop (24c/30GB), scelto per dare a PGlite il massimo vantaggio. I tempi di build restano fuori scala.
- Il peak RSS non è usato come metrica: nelle run è rumoroso e non monotono (la run a 250k ha un picco vicino a quella a 50k), perché include V8 e JS oltre all'heap WASM. Le metriche affidabili sono build, latenza e disco.
- Un solo motore di riferimento misurato. sqlite-vec e DuckDB-VSS restano da provare.
- Indici di famiglie diverse: PGlite usa HNSW, il riferimento usa IVF_PQ (quantizzato, da cui anche il disco più compatto). Non cambia il quadro su tempi di build e latenza, ma non è un confronto a parità di tipo di indice; LanceDB supporterebbe anche HNSW. La recall non viene confrontata.
- Varianza tra run: la build a 250k è stata misurata a 912 s e 1057 s in due run pulite distinte (~15% di varianza). La tabella riporta la seconda. La scala del fenomeno non cambia.

## Cosa non conclude

Non decide quale motore usare e non propone di sostituire PGlite per il database applicativo, dove tra dati transazionali piccoli e zero dipendenze native è una scelta sensata. Mette solo dei numeri sotto una domanda aperta: dove deve vivere l'indice del corpus?
