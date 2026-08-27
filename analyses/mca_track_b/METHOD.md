# MCA-MULTI-Serrano Track B — portage cross_corpus

Référence : `HEAT/03_analyses/pipelines/cib_p3/docs/MCA-MULTI-Serrano_TRACK_B_251_SPEC.md`  
(Canicule FULL → **251** comptes ; `UNFL_sum` + Serrano α=0,05)

## Paramètres (Canicule, sauf sélection 100 %)

| Paramètre | Valeur |
|---|---|
| seed | 20260624 |
| sélection | **100 % du corpus** (union RTW ∪ RPL ∪ originaux, sans filtre top 50 %) |
| couches | RTW, RPL, QTE, MEN, URL (`cooccurrence_shared_objects`) |
| cap comptes/objet | 80 |
| max nœuds après overlap | 20 000 |
| seuil poids | médiane |
| MULTI | Leiden–Mucha γ=1, ω=0,1 |
| flatten | **UNFL_sum** uniquement |
| Serrano | α=0,05, undirected OR |
| repli deg2 / LCC | **non** |

Écart volontaire vs Canicule : la spec Track B coupait au **top 50 %** `exact_topk` ; ici on garde **100 %** du corpus (union des comptes avec au moins un RT, une reply ou un original). Le reste de la chaîne est identique.

La taille de cohorte **n’est pas un quota** : 251 est le résultat Canicule (avec top 50 %), pas une cible.

## Enrichissement table (CSV / HTML)

| Colonne | Définition |
|---|---|
| **% RT** | `100 × nombre_RT / nombre_publications` où RT = publications avec `tweet_type == "retweet"` (CocktailFusion). Les non-RT sont `original`, `quote`, `reply`. |
| **2 pubs non-RT** | Les 2 publications non-retweet (`tweet_type ≠ retweet`) au plus fort **engagement**. |
| **2 RT** | Les 2 retweets (`tweet_type == retweet`) au plus fort engagement. |
| **Engagement** | `like_count + retweet_count + reply_count + quote_count` (même somme que `build_pipeline.engagement`). |

Liens status : `https://x.com/i/status/{tweet_id}` lorsque l’id est disponible.

Ré-enrichissement sans recalculer MCA :

```bat
py -3.13 scripts\mca_multi_serrano_track_b.py --enrich-only
py -3.13 scripts\build_mca_cohort_html.py
```

## Exécution

```bat
cd c:\Users\th8992be\Desktop\cross_corpus
py -3.13 scripts\mca_multi_serrano_track_b.py
py -3.13 scripts\build_mca_cohort_html.py
```

## Sorties

- `outputs/analyses/mca_track_b/*_cohort_UNFL_sum_serrano05.csv`
- `outputs/analyses/mca_track_b/*_selected_handles.json` (highlight connectome)
- `outputs/analyses/comptes_selectionnes.html` (tables par corpus)
- Connectome : checkbox « Highlight comptes coordonnés »
