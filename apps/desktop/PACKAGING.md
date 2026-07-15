# Packaging desktop

Questa guida operativa implementa le scelte documentate in [`knowledge/architettura/packaging-distribuzione.md`](../../knowledge/architettura/packaging-distribuzione.md).

## Comandi locali

Tutti i comandi partono dalla radice del repository.

| Comando | Output |
|---|---|
| `npm run package:desktop:dir` | App spacchettata per smoke test locale |
| `npm run package:desktop:dir:from-build` | App spacchettata riusando una build `out/` esistente |
| `npm run package:desktop:win` | Installer Windows NSIS `.exe` |
| `npm run package:desktop:mac` | DMG e ZIP macOS universali |
| `npm run package:desktop:linux` | AppImage Linux |

Gli artefatti vengono scritti in `apps/desktop/release/`.
Le build locali e di PR usano `--publish never`, così non pubblicano asset su GitHub Releases.

## Firma e notarizzazione

La firma resta obbligatoria per le release ufficiali, ma non per gli smoke test di PR.
Per generare pacchetti non firmati in CI:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:desktop:dir
```

Per la release macOS servono certificato Developer ID e credenziali di notarizzazione Apple.
La configurazione abilita Hardened Runtime e usa le entitlement minime richieste da Electron in `apps/desktop/build/`.

Per la release Windows il percorso previsto dalla knowledge base è Authenticode tramite Azure Trusted Signing.
Le credenziali Azure e i dati del profilo di firma devono vivere nei secret della pipeline di release, non nel repository.
Il target Windows dell'MVP è x64, coerente con la piattaforma dei primi tester.
ARM64 verrà abilitato dopo avere verificato dipendenze native, firma e installer su Windows on ARM.

## Canali di release

Il comando di release applicativa è:

```bash
npm run release:desktop
```

Questo usa `electron-builder --publish onTagOrDraft`, quindi pubblica gli artefatti solo nel flusso di release.
L'aggiornamento dell'app resta separato dall'aggiornamento dell'indice normativo: l'indice è un pacchetto dati read-only distribuito sul proprio canale.
