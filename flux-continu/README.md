# Flux continu — cross-corpus

Viewer : [flux-continu](https://mshubeco.github.io/cross-corpus/flux-continu/?corpus=ebola)

## Temporalités

| Mode | URL | Données | Comportement |
| --- | --- | --- | --- |
| **Fenêtre 3j (lissée)** — défaut | `?corpus=<id>` | `manifest.json` + `frames/` | Frame **D** = interactions **D−2 → D**. Un compte peut rester visible 1–2 j après son activité. |
| **Journalier strict** | `?corpus=<id>&tempo=d1` | `manifest_daily.json` + `frames_daily/` | Frame **D** = interactions du **seul jour D**. |

Critères communs : RT + reply + quote + mention · FA2/frame + Procrustes · tracks Louvain (Jaccard ≥ 0,3) · couleurs Louvain global.

## Régénération

```bash
cd Desktop/cross_corpus/pipelines/flux_w3
# mode 3j (écrase frames/ + manifest.json)
py -3.13 scripts/build_corpus_flux.py --all
# mode journalier (écrit frames_daily/ + manifest_daily.json, sans toucher au 3j)
py -3.13 scripts/build_corpus_flux.py --all --window-days 1
```
