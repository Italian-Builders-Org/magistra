---
type: Componente
title: Contratto retrieval ↔ API
description: Confine data plane / API layer.
tags: [pipeline, api, contract]
timestamp: 2026-06-19T00:00:00Z
---

# Contratto retrieval ↔ API

**Stato:** bozza v0.1. Allineamento richiesto tra responsabili **data plane** e **API layer** (e team per H3 in dev).

## Perimetri (DECISO)

| Layer | Responsabilità |
|-------|----------------|
| **Data plane** | Ingest, parse, normalize, chunk, index **write**, refresh, **retrieval service** |
| **API layer** | HTTP pubblico, auth, chat, orchestrazione RAG, LLM, upload utente |

L'API **non** legge/scrive pgvector direttamente. **Non** parsa AKN.

## Architettura target: H1 (DECISO)

Retrieval esposto come servizio interno HTTP.

### `POST /internal/retrieve`

**Richiesta:**

```json
{
  "query": "quali sono i termini per il ricorso gerarchico?",
  "query_date": "2026-06-19",
  "filters": {
    "tipo_atto": ["legge"],
    "eli_prefix": "/eli/it/stato/legge/1990"
  },
  "top_k": 8,
  "min_score": 0.72
}
```

`query_date` opzionale: se assente, il servizio usa **oggi** (DECISO).

**Risposta:**

```json
{
  "results": [
    {
      "chunk_id": "uuid",
      "score": 0.89,
      "testo": "...",
      "citation": {
        "eli": "/eli/it/stato/legge/1990/08/07/241/...",
        "tipo": "comma",
        "numero": "art. 29, comma 1",
        "vigenza_da": "1990-08-08",
        "vigenza_a": null,
        "tipo_atto": "legge",
        "numero_atto": "241/1990"
      },
      "source_url": "https://dati.normattiva.it/..."
    }
  ],
  "meta": {
    "query_date_applied": "2026-06-19",
    "results_count": 1
  }
}
```

### `GET /internal/health`

Stato indice, ultimo refresh, `model_id` embedding attivo (**TBD** campi esatti).

## Regole condivise

1. Filtro vigenza applicato dal retrieval, non dall'LLM.
2. `results` vuoto → API **non** genera risposta normativa fondata solo su LLM.
3. Oggetto `citation` è completo; l'API non lo ricostruisce.
4. Upload utente: indice separato (**TBD**); fuori da questo contratto v0.1.

## H3 in dev (TBD con il team)

Possibile invocazione in-process della stessa interfaccia `retrieve(...)` senza HTTP, **solo dev**, se il team lo preferisce per velocità. Il contratto logico resta identico a H1.

## Versioning

Header `X-Contract-Version: 0.1`: breaking change con bump e accordo tra i responsabili dei due layer.
