# Flux continu — cross-corpus

Même interface et critères que [HEAT · flux continu](https://mshubeco.github.io/heat-flux-continu/) :

- fenêtre glissante **3 jours**
- interactions RT + reply + quote + mention
- `min_edge_weight = 2`
- layout **FA2 par frame** + Procrustes
- tracks Louvain locaux (Jaccard ≥ 0,3)
- couleurs **Louvain global** (partition connectome)

URL : `https://mshubeco.github.io/cross-corpus/flux-continu/?corpus=<id>`

Pipeline : `Desktop/cross_corpus/pipelines/flux_w3/`
