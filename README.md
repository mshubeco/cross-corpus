# Cross-corpus — viewers HTML

Site statique des HTML de travail (anciennement `http://localhost:8766/`).

**Page d’accueil :** https://mshubeco.github.io/cross-corpus/connectome/

Après push : **Settings → Pages → Deploy from branch `main` / root**.

| Page | Chemin |
|------|--------|
| Connectomes (accueil) | [`/connectome/`](https://mshubeco.github.io/cross-corpus/connectome/) |
| Intersection 3 corpus santé | [`/analyses/health3_overlap.html`](https://mshubeco.github.io/cross-corpus/analyses/health3_overlap.html) |
| Comptes MCA Track B | [`/analyses/comptes_selectionnes.html`](https://mshubeco.github.io/cross-corpus/analyses/comptes_selectionnes.html) |
| Analyses corpus entier | [`/analyses/cross_corpus_analyses.html`](https://mshubeco.github.io/cross-corpus/analyses/cross_corpus_analyses.html) |

Clone local de travail : `Desktop\cross_corpus_github_pages`.

Les JSON des graphes (`connectome/data/*/graph.json`, `analyses/health3_overlap/*.json`) sont inclus : les pages `fetch` ne marchent pas en `file://`.
