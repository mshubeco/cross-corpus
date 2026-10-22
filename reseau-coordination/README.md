# Réseau de coordination

Page sœur du [connectome](../connectome/) : graphe de **co-retweet** filtré par le filtre de disparité de **Serrano et al. 2009**.

URL : `https://mshubeco.github.io/cross-corpus/reseau-coordination/?corpus=<id>`

## Méthode

| Paramètre | Valeur |
|-----------|--------|
| Couche | co-RT (parents retweetés en commun) |
| Seuil candidats | `min_co_rt ≥ 2` |
| Cap parent viral | ≤ 80 RTers (aligné MCA) |
| Filtre | Serrano disparity, α = **0,05**, règle **OR** |
| Formule | \(p_{ij}^{(i)} = (1 - w_{ij}/s_i)^{k_i-1}\) ; garder si \(p_u < \alpha\) ou \(p_v < \alpha\) |

**Citation :** Serrano, M. Á., Boguñá, M., & Vespignani, A. (2009). Extracting the multiscale backbone of complex weighted networks. *PNAS*, 106(16), 6483–6488.

Vocabulaire affiché : *coordination d’amplification / backbone* — **pas** une preuve d’inauthenticité.

## Couleurs & discours

- **Louvain coordination** : partition Louvain sur le backbone Serrano (défaut)
- **Louvain connectome** : couleurs du Louvain du connectome d’origine (projection par `screen_name`)
- **Panel droit** : analyse discursive brève des clusters de coordination (hashtags / lexique G² sur pubs hors RT)
- **Labels** : mêmes règles que le connectome (révélation progressive au zoom, anti-chevauchement) ; **taille ∝ PageRank** pondéré (α=0,85, weight = co-RT Serrano) sur le backbone
- **Vue 3D** (bouton) : extrusion Z temporelle
  - **A · Chrono** : \(Z =\) médiane(\(t_{co}\)) normalisée — \(t_{co}=\max(t_{RT_u},t_{RT_v})\)
  - **B · Sync** : \(Z = -\mathrm{médiane}(\Delta t)\) normalisée — haut = co-RT plus synchrones

## Pipeline

`Desktop/cross_corpus/pipelines/coordination_cort_serrano/`

```bat
py -3.13 scripts/build_corpus.py --all
py -3.13 scripts/enrich_colors_discourse.py
```

Chaque corpus produit `data/<id>/graph.json`, `meta.json`, `protocol.json`, `discourse.json`.
