---
type: Termine
title: Cifratura
description: Trasformazione di dati in forma illeggibile senza la chiave, usata per proteggere segreti e documenti a riposo e in transito.
tags: [glossario, sicurezza, cifratura]
timestamp: 2026-07-05T00:00:00Z
---

# Cifratura

Trasformazione di dati in una forma illeggibile senza la chiave corrispondente, per proteggerne la riservatezza.

Nella piattaforma è usata per le [chiavi API](../modello-dati/chiave-api.md) locali (cifrate a riposo, mai in chiaro nel database o nei log) e per i [documenti](../modello-dati/documento.md) nell'[archiviazione locale](../architettura/archiviazione-documenti.md); l'unico traffico in transito da proteggere su TLS è quello opzionale verso i provider LLM remoti. È un requisito di [sicurezza](../requisiti/sicurezza.md) e [privacy](../requisiti/privacy-e-dati-personali.md).

Gli algoritmi (AES-256-GCM), la conservazione delle chiavi e il loro ciclo di vita sono definiti nel design di [cifratura e chiavi](../architettura/cifratura-e-chiavi.md).
