# Cross-corpus — viewers HTML

Site statique des HTML de travail (anciennement `http://localhost:8766/`).

**Page d’accueil :** https://mshubeco.github.io/cross-corpus/connectome/

Après push : **Settings → Pages → Deploy from branch `main` / root**.

| Page | Chemin |
|------|--------|
| Connectomes (accueil) | [`/connectome/`](https://mshubeco.github.io/cross-corpus/connectome/) |
| Hub analyses (tous corpus) | [`/analyses/`](https://mshubeco.github.io/cross-corpus/analyses/) |
| Redirection par corpus | [`/analyses/ebola.html`](https://mshubeco.github.io/cross-corpus/analyses/ebola.html) → `intercomm/ebola.html` (idem hantavirus, mpox, macron_nucleaire, ebola_2_2026, hmpv, hmpv_fr, canicule) |
| Connectome HMPV | [`/connectome/?corpus=hmpv`](https://mshubeco.github.io/cross-corpus/connectome/?corpus=hmpv) |
| Connectome HMPV FR | [`/connectome/?corpus=hmpv_fr`](https://mshubeco.github.io/cross-corpus/connectome/?corpus=hmpv_fr) |
| Connectome Canicule | [`/connectome/?corpus=canicule`](https://mshubeco.github.io/cross-corpus/connectome/?corpus=canicule) |
| Flux continu (tous corpus) | [`/flux-continu/`](https://mshubeco.github.io/cross-corpus/flux-continu/?corpus=ebola) — critères [HEAT flux continu](https://mshubeco.github.io/heat-flux-continu/) (fenêtre 3j · FA2 · Procrustes · Louvain) |
| Flux intercommunautaires | [`/analyses/intercomm/`](https://mshubeco.github.io/cross-corpus/analyses/intercomm/ebola.html) |
| Intersection 3 corpus santé | [`/analyses/health3_overlap.html`](https://mshubeco.github.io/cross-corpus/analyses/health3_overlap.html) |
| Comptes MCA Track B | [`/analyses/comptes_selectionnes.html`](https://mshubeco.github.io/cross-corpus/analyses/comptes_selectionnes.html) |
| Analyses corpus entier | [`/analyses/cross_corpus_analyses.html`](https://mshubeco.github.io/cross-corpus/analyses/cross_corpus_analyses.html) |

Clone local de travail : `Desktop\cross_corpus_github_pages`.

Les JSON des graphes (`connectome/data/*/graph.json`, `analyses/health3_overlap/*.json`) sont inclus : les pages `fetch` ne marchent pas en `file://`.
