# -*- coding: utf-8 -*-
"""Cadrages du connectome HMPV FR, au niveau du texte hors retweet.

Les catégories sont celles lues sur les 577 publications propres
(janvier–juin 2025). Un compte prend la couleur du propos de son texte
le plus aimé. Un compte sans propos propre prend la couleur du compte
qu'il relaie, si cette cible est unique.
"""
from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV = Path(r"c:\Users\th8992be\Desktop\test lucini\minici_2nd_outputs\hmpv_fr_corpus_complet_2547.csv")
GRAPH = ROOT / "connectome" / "data" / "hmpv_fr" / "graph.json"
OUT = ROOT / "connectome" / "data" / "hmpv_fr" / "discourse_frames.json"
REVIEW = ROOT / "scripts" / "_hmpv_fr_frames_review.txt"

FRAMES = (
    "depeche",
    "submersion",
    "refus",
    "mise_au_point",
    "notice",
    "bulletin",
    "scenario",
    "inde",
    "terrain",
)

FRAME_META = [
    {
        "id": "depeche",
        "label": "Dépêche Chine",
        "hint": "Titre repris : nouvelle épidémie, cinq ans après le Covid, hôpitaux saturés.",
        "color": "#ff8a3d",
    },
    {
        "id": "submersion",
        "label": "Submersion",
        "hint": "État d’urgence, crématoriums, quatre virus, vidéos d’hôpitaux.",
        "color": "#ff4d6a",
    },
    {
        "id": "refus",
        "label": "Refus",
        "hint": "On ne recommence pas. La dépêche est citée pour être refusée.",
        "color": "#f5e663",
    },
    {
        "id": "mise_au_point",
        "label": "Mise au point",
        "hint": "Pas d’état d’urgence, OMS, démenti, pas un virus nouveau.",
        "color": "#3ecfb2",
    },
    {
        "id": "notice",
        "label": "Notice",
        "hint": "Virus connu depuis 2001, proche du VRS, souvent bénin.",
        "color": "#7aa2ff",
    },
    {
        "id": "bulletin",
        "label": "Bulletin",
        "hint": "Parts hebdomadaires : grippe, VRS, rhinovirus, métapneumovirus.",
        "color": "#9be15d",
    },
    {
        "id": "scenario",
        "label": "Scénario",
        "hint": "Cinéma, laboratoire, deep state, plan, arme. Quelqu’un organise la séquence.",
        "color": "#e06cff",
    },
    {
        "id": "inde",
        "label": "Fait divers Inde",
        "hint": "Premier cas 2025, nourrisson à Bangalore.",
        "color": "#38bdf8",
    },
    {
        "id": "terrain",
        "label": "Terrain",
        "hint": "Un service, une toux, une unité. Pas une dépêche.",
        "color": "#d4a574",
    },
]

URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)
MENT_RE = re.compile(r"@\w+")
HASH_RE = re.compile(r"#\w+")
SPACE_RE = re.compile(r"\s+")
HMPV_RE = re.compile(r"hmpv|metapneumovirus|métapneumovirus|meta pneumovirus", re.I)


def norm(text: str) -> str:
    t = URL_RE.sub(" ", text or "")
    t = MENT_RE.sub(" ", t)
    t = t.replace("#", " ")
    t = t.lower().replace("’", "'").replace("`", "'")
    t = t.replace("–", " ").replace("—", " ").replace("-", " ")
    t = t.replace("œ", "oe")
    return SPACE_RE.sub(" ", t).strip()


def has_any(text: str, phrases: tuple[str, ...]) -> bool:
    return any(p in text for p in phrases)


BRUIT = (
    "stockmarket", "stock market", "viratkohli", "rohitsharma", "dance challenge",
    "gagner de l'argent", "militants du palu", "optionstrading", "options trading",
    "verifiedbysensibull", "champions trophy", "goodbadugly",
)
BULLETIN = (
    "sentinelles", "patients preleves", "patients prélèves",
    "chez les generalistes", "chez les généralistes",
    "infections respiratoires aigu",     "taux de positivite", "taux de positivité",
    "inspq", "vigie", "pourcentages de tests", "pourcentage de tests",
)
TERRAIN = (
    "mon service", "mon unite", "mon unité", "j'ai le hmpv", "moi je suis",
    "je tousse", "mon rhume",
    "en eclosion", "en éclosion", "resultat des tests", "résultat des tests",
    "positif a grippe", "positif à grippe",
)
INDE = (
    "bengaluru", "bebe de 8", "bébé de 8", "8 mois",
    "l'inde signale", "inde signale", "en inde, une femme", "inde, une femme",
    "teste positif a bangalore", "testé positif à bangalore",
    "positif a bangalore", "positif à bangalore",
)
SCENARIO = (
    "deep state", "deep-state", "laboratoire", "cinema covid", "cinéma covid",
    "refaire le cinema", "refaire le cinéma", "arme biologique", "graphene",
    "graphène", "maladie x", "plan diabolique", "smart dust", "chemtrail",
    "fabriquee en laboratoire", "fabriquée en laboratoire", "ils mettent le paquet",
    "piquouze", "effets secondaires de pfizer", "liste des effets secondaires",
    "reconfiner", "nouveau confinement", "warp speed", "genocide", "génocide",
    " nwo", "#nwo",
)
REFUS = (
    "ne recommencerons pas", "ne refaisons pas", "ne recommencons pas",
    "inutile de paniquer", "allez vous faire foutre", "ne nous conformerons pas",
    "nous ne nous conformerons pas", "ils pourront pas nous faire le coup",
    "periode liberticide", "période liberticide", "est devenu un jeu",
    "ne s'arreteront", "ne s'arrêteront", "aucun mot de cette histoire",
    "je n'y crois pas", "je ne crois",
)
MISE_FORT = (
    "n'a pas officiellement", "n'a pas declare", "n'a pas déclaré",
    "pas officiellement declare", "pas officiellement déclaré",
    "desintox", "désintox", "fake news", "info ou intox",
    "pas du tout ce que", "le cdc chinois a evoque", "le cdc chinois a évoqué",
    "n'a rien de nouveau", "rien de nouveau", "anecdotique", "inquiète surtout",
    "inquiete surtout", "voir clair",
    "pas un nouveau virus", "n'est pas un nouveau", "n'est pas un nouveau",
    "ce ne sera en tout cas pas", "torrent de desinformation",
    "torrent de désinformation", "plusieurs intox", "demystifier", "démystifier",
    "pas de source fiable",
)
MISE_FAIBLE = (
    "oms rassure", "pas de danger", "aucun cas", "vigilance sans panique",
    "se veulent rassurant", "se veut rassurant", "aucune urgence officielle",
    "aucune urgence n", "appelle au calme", "sans tomber dans la panique",
    "faisons le point", "a dementi", "a démenti",
)
NOTICE = (
    "2001", "semblable a un rhume", "semblable à un rhume", "comme un rhume",
    "qu'est ce que", "qu'est-ce que", "quiz", "pneumoviridae", "voisin du vrs",
    "virus commun", "identifie pour la premiere", "identifié pour la première",
    "decouvert en 2001", "découvert en 2001", "questions sur",
    "explique le metapneumovirus", "explique le métapneumovirus",
    "infection benigne", "infection bénigne", "en l'absence de vaccin",
    "5 questions", "8 questions", "20 questions", "syndrome grippal",
    "codécouvert", "codecouvert", "antiviraux",
)
SUBMERSION = (
    "crematorium", "crématorium", "crematoire", "crématoire",
    "etat d'urgence", "état d'urgence", "etat d urgence",
    "mysterieuse", "mystérieuse", "submerge", "poumon blanc",
    "unites hospitalieres", "unités hospitalières",
    "hopitaux debord", "hôpitaux débord", "hopitaux surpeupl", "hôpitaux surpeupl",
    "pompes funebres", "pompes funèbres",
)


def classify(raw: str) -> str:
    n = norm(raw)
    n_hash = len(HASH_RE.findall(raw or ""))
    if has_any(n, BRUIT) or (n_hash >= 8 and len(n) < 90):
        return ""
    if has_any(n, BULLETIN):
        return "bulletin"
    if has_any(n, TERRAIN):
        return "terrain"
    if has_any(n, INDE) and len(n) > 40:
        return "inde"
    if has_any(n, SCENARIO) or " nwo " in f" {n} ":
        return "scenario"
    if has_any(n, MISE_FORT):
        return "mise_au_point"
    if has_any(n, REFUS):
        return "refus"
    if has_any(n, SUBMERSION):
        return "submersion"
    if has_any(n, MISE_FAIBLE):
        return "mise_au_point"
    if has_any(n, NOTICE):
        return "notice"
    if HMPV_RE.search(n) and has_any(
        n,
        (
            "chine", "china", "epidem", "épidém", "hopital", "hôpital",
            "propage", "nouveau virus", "flambe", "flambé", "saturation",
            "inquiet", "inquiét",
        ),
    ):
        return "depeche"
    return ""


def label_of(frame: str) -> str:
    for spec in FRAME_META:
        if spec["id"] == frame:
            return spec["label"]
    return frame


def main() -> None:
    rows = list(csv.DictReader(CSV.open(encoding="utf-8")))
    own = [r for r in rows if not (r.get("text") or "").startswith("RT @")]
    posts = []
    for r in own:
        frame = classify(r.get("text") or "")
        likes = int(r.get("like_count") or 0)
        posts.append(
            {
                "user": (r.get("author_username") or "").lower().lstrip("@"),
                "at": (r.get("created_at") or "")[:10],
                "likes": likes,
                "frame": frame,
                "text": (r.get("text") or "").replace("\n", " ").strip(),
            }
        )

    by_user: dict[str, list[dict]] = defaultdict(list)
    for p in posts:
        if p["user"]:
            by_user[p["user"]].append(p)

    own_frame: dict[str, str] = {}
    mixed_accounts: list[tuple[str, Counter]] = []
    for user, items in by_user.items():
        scored = [p for p in items if p["frame"]]
        if not scored:
            continue
        by_f: dict[str, list[dict]] = defaultdict(list)
        for p in scored:
            by_f[p["frame"]].append(p)
        ranked = sorted(
            by_f.items(),
            key=lambda kv: (len(kv[1]), sum(p["likes"] for p in kv[1])),
            reverse=True,
        )
        own_frame[user] = ranked[0][0]
        if len(ranked) > 1:
            mixed_accounts.append((user, Counter({f: len(ps) for f, ps in ranked})))

    graph = json.loads(GRAPH.read_text(encoding="utf-8"))
    nodes = graph["nodes"]
    handles = []
    for n in nodes:
        handles.append(str(n.get("l") or "").lower().lstrip("@"))

    known = {h: f for h, f in own_frame.items() if h in set(handles)}
    # Relais : l'auteur de l'acte (s) prend le cadre de la cible (t)
    # seulement si toutes ses cibles les plus lourdes disent la même chose.
    outgoing: dict[int, list[tuple[float, str]]] = defaultdict(list)
    for e in graph["edges"]:
        t = handles[e["t"]]
        frame = known.get(t)
        if not frame:
            continue
        outgoing[e["s"]].append((float(e.get("w") or 1), frame))

    # Un texte propre non classé bloque le relais : la personne a parlé,
    # on ne lui prête pas la couleur d'un retweet.
    spoke = set(own_frame)
    for p in posts:
        body = norm(p["text"])
        n_hash = len(HASH_RE.findall(p["text"]))
        noisy = has_any(body, BRUIT) or (n_hash >= 8 and len(body) < 90)
        if p["user"] and not noisy and len(body) > 50:
            spoke.add(p["user"])
    prose = spoke
    assigned = dict(known)
    n_relay = 0
    for i, h in enumerate(handles):
        if not h or h in prose:
            continue
        cands = outgoing.get(i)
        if not cands:
            continue
        best_w = max(w for w, _f in cands)
        frames_at_best = {f for w, f in cands if w == best_w}
        if len(frames_at_best) != 1:
            continue
        assigned[h] = next(iter(frames_at_best))
        n_relay += 1

    mixed_lines = []
    for user, tally in sorted(mixed_accounts, key=lambda kv: -sum(kv[1].values())):
        if user not in known:
            continue
        parts = " · ".join(f"{label_of(f)} {n}" for f, n in tally.most_common())
        mixed_lines.append(f"@{user} — {parts}. Couleur : {label_of(known[user])} (texte le plus aimé).")

    lines = [
        f"textes {len(posts)} classés {sum(1 for p in posts if p['frame'])} "
        f"gris {sum(1 for p in posts if not p['frame'])}",
        f"auteurs propres {len(own_frame)} dans le graphe {len(known)} relais {n_relay} colorés {len(assigned)}",
        "textes " + ", ".join(f"{label_of(f)} {n}" for f, n in Counter(p["frame"] or "gris" for p in posts).most_common()),
        "comptes " + ", ".join(f"{label_of(f)} {n}" for f, n in Counter(assigned.values()).most_common()),
        "",
    ]
    for frame in ("",) + FRAMES:
        name = label_of(frame) if frame else "GRIS"
        sample = [p for p in posts if p["frame"] == frame]
        sample.sort(key=lambda p: -p["likes"])
        lines.append(f"## {name} ({len(sample)})")
        for p in sample[:8]:
            lines.append(f"  {p['likes']:4} {p['at']} @{p['user']}: {p['text'][:200]}")
        lines.append("")
    lines.append("## MÊLÉS")
    lines.extend(mixed_lines[:30])
    REVIEW.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:6]))
    print("review", REVIEW)

    payload = {
        "corpus": "hmpv_fr",
        "dated": "2026-11-04",
        "method": (
            "Chaque publication hors retweet est lue comme un propos : "
            "dépêche Chine, submersion, refus, mise au point, notice, bulletin, "
            "scénario, fait divers Inde, ou terrain. "
            "Un compte prend le propos de ses textes ; s’ils divergent, "
            "la couleur suit le texte le plus aimé et le compte est signalé comme mêlé. "
            "Un compte sans propos propre prend la couleur du compte qu’il relaie, "
            "quand cette cible est unique. Le gris n’est pas un dixième discours."
        ),
        "nTextAccounts": len(own_frame),
        "nFromText": len(known),
        "nFromRelay": n_relay,
        "nFromCommunity": 0,
        "mixedTitle": "Comptes qui tiennent deux propos",
        "mixed": mixed_lines[:12],
        "frames": FRAME_META,
        "a": {h: f for h, f in assigned.items() if h},
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, "nodes", len(assigned), "bytes", OUT.stat().st_size)

    # Série quotidienne pour la figure.
    daily = defaultdict(Counter)
    actors = defaultdict(list)
    for p in posts:
        if not p["frame"]:
            continue
        daily[p["at"]][p["frame"]] += 1
        actors[p["frame"]].append(p)
    fig = {
        "daily": {d: dict(c) for d, c in sorted(daily.items())},
        "actors": {
            f: [
                {
                    "user": p["user"],
                    "at": p["at"],
                    "likes": p["likes"],
                    "text": p["text"][:160],
                }
                for p in sorted(actors[f], key=lambda x: (-x["likes"], x["at"]))[:6]
            ]
            for f in FRAMES
        },
        "n_texts": Counter(p["frame"] for p in posts if p["frame"]),
        "n_accounts_color": Counter(assigned.values()),
        "n_relay": n_relay,
        "n_from_text": len(known),
    }
    fig_path = ROOT / "scripts" / "_hmpv_fr_discours_figure.json"
    fig_path.write_text(json.dumps(fig, ensure_ascii=False), encoding="utf-8")
    print("figure", fig_path)


if __name__ == "__main__":
    main()
