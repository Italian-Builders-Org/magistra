// Schema iniziale del database applicativo (migrazione 001).
//
// DDL in dialetto Postgres standard, cosi il motore concreto (oggi PGlite
// embedded) resta sostituibile con qualunque backend Postgres-compatibile. Le
// entita e i loro campi seguono il modello applicativo della knowledge base.
//
// Scelte di schema:
//   - Chiavi primarie `TEXT`: gli identificativi sono UUID generati
//     dall'applicazione, cosi lo schema non dipende da estensioni del motore.
//   - Timestamp `TIMESTAMPTZ DEFAULT now()`: la data la mette il database; le
//     colonne `aggiornato_il`/`aggiornata_il` vengono riscritte a ogni update.
//   - Campi denormalizzati (`versioni`, `query_generate`, `citazioni`,
//     `chunk_usati`, `configurazione`) come `JSONB`: snapshot per tracciabilita,
//     la cui forma interna appartiene ad altri contesti (RAG, conversione).
//   - Integrita referenziale esplicita: il documento cade col progetto
//     (CASCADE); la conversazione sopravvive al progetto perdendone il legame
//     (SET NULL, FK opzionale); il messaggio cade con la conversazione.

export const SCHEMA_INIZIALE_SQL = `
CREATE TABLE progetto (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  creato_il     TIMESTAMPTZ NOT NULL DEFAULT now(),
  aggiornato_il TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documento (
  id           TEXT PRIMARY KEY,
  progetto_id  TEXT NOT NULL REFERENCES progetto(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  formato      TEXT NOT NULL,
  uri_storage  TEXT,
  versioni     JSONB NOT NULL DEFAULT '[]'::jsonb,
  caricato_il  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documento_progetto ON documento (progetto_id);

CREATE TABLE conversazione (
  id            TEXT PRIMARY KEY,
  progetto_id   TEXT REFERENCES progetto(id) ON DELETE SET NULL,
  titolo        TEXT,
  creata_il     TIMESTAMPTZ NOT NULL DEFAULT now(),
  aggiornata_il TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversazione_progetto ON conversazione (progetto_id);

CREATE TABLE messaggio (
  id               TEXT PRIMARY KEY,
  conversazione_id TEXT NOT NULL REFERENCES conversazione(id) ON DELETE CASCADE,
  ordine           INTEGER NOT NULL,
  ruolo            TEXT NOT NULL CHECK (ruolo IN ('utente', 'assistente', 'sistema')),
  contenuto        TEXT NOT NULL,
  query_generate   JSONB NOT NULL DEFAULT '[]'::jsonb,
  citazioni        JSONB NOT NULL DEFAULT '[]'::jsonb,
  chunk_usati      JSONB NOT NULL DEFAULT '[]'::jsonb,
  creato_il        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversazione_id, ordine)
);

-- Il vincolo UNIQUE (conversazione_id, ordine) fornisce gia un indice con
-- conversazione_id come colonna di testa: serve sia il filtro per conversazione
-- sia l'ORDER BY ordine, quindi non serve un indice separato su conversazione_id.

CREATE TABLE chiave_api (
  id             TEXT PRIMARY KEY,
  provider       TEXT NOT NULL,
  valore_cifrato TEXT NOT NULL,
  configurazione JSONB NOT NULL DEFAULT '{}'::jsonb,
  creata_il      TIMESTAMPTZ NOT NULL DEFAULT now(),
  aggiornata_il  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`
