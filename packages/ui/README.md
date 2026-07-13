# @magistra/ui

Questa libreria contiene i componenti UI condivisi di Magistra.
I componenti base sono generati da [shadcn/ui](https://ui.shadcn.com/docs/components) e poi mantenuti come codice del repository.

## Aggiungere un componente shadcn

1. Identifica il componente nella documentazione shadcn: <https://ui.shadcn.com/docs/components>.
2. Dal root del repository, esegui il comando `add` indicando la configurazione di questo package:

```bash
npx shadcn@latest add sidebar -c packages/ui
```

Sostituisci `sidebar` con il nome del componente shadcn da aggiungere.
