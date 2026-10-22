# -*- coding: utf-8 -*-
"""Build discourse.json for every CONNECTOME corpus.

Sources (when available):
  - analyses/intercomm/<id>_profiles.json  → hashtags / terms (z)
  - connectome/data/<id>/graph.json        → communities90 + hubs
  - CSV CocktailFusion → keyness (si pas de profils) + effectifs #
    + co-occurrences message + parts par communauté

Désignations = panneau COMMUNAUTÉS uniquement (pas sur le graphe).
"""
from __future__ import annotations

import csv
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
CONNECTOME = Path(__file__).resolve().parent
PROFILES_DIR = ROOT / "analyses" / "intercomm"
MANIFEST = CONNECTOME / "manifest.json"
CROSS_CORPUS_EXPORTS = Path(r"C:\Users\th8992be\Desktop\cross_corpus")

LIMIT_FR = (
    "Label opérationnel fondé sur lexique distinctif (z) / structure / échantillons — "
    "pas une appartenance partisane des comptes ordinaires."
)

# Overrides manuels (sinon auto depuis # / termes + hub)
DESIGNATIONS: dict[str, dict[int, str]] = {
    "ebola_2_2026": {
        12: "Vaccino-critique / peurs épidémiques",
        15: "Alertes & viralité Ebola",
        11: "Info RDC · Nord-Kivu",
        16: "Relais presse / OMS",
        6: "Riposte sanitaire RDC",
        24: "Couverture conflit × Ebola",
    },
}

# Cap liste stockée pour highlight (n réel = tag_n_accounts)
TAG_ACCOUNTS_STORE_CAP = 15000
N_TAGS = 16          # # distinctifs / communauté (profils ou keyness CSV)
N_WORDS = 8
N_BIGRAMS = 8        # bigrammes distinctifs / communauté
N_SAMPLES = 5
N_COOC = 15          # top co-occurrents préchargés / tag
MIN_HT_N = 3         # keyness CSV : min occurrences dans le pôle
MIN_TERM_N = 8
MIN_BG_N = 3
Z_HT = 1.4
Z_TERM = 1.7
Z_BG = 1.5
TOP_N_COM_FALLBACK = 14  # si pas de profils : pôles communities90
# Cap panneau / stockage bigrammes (top global par comptes)
BIGRAM_STORE_TOP = 120

TOKEN_RX = re.compile(r"[a-z0-9àâäéèêëïîôùûüçœæ]{3,}", re.I)
URL_RX = re.compile(r"https?://\S+|t\.co/\S+|www\.\S+", re.I)
MENTION_RX = re.compile(r"@\w+")
# Stopwords FR + EN (formes courtes / grammaticales / verbes supports).
# Appliqué à la tokenisation ET au filtrage des key_words / word_*.
FR_STOP = {
    # articles / prépositions / conjonctions / pronoms
    "a", "ai", "ainsi", "alors", "apres", "après", "au", "aucun", "aucune", "aussi",
    "autre", "autres", "aux", "avec", "avoir", "avant", "c", "ca", "ça", "car", "ce",
    "cela", "celle", "celles", "celui", "ces", "cet", "cette", "ceux", "chaque",
    "chez", "chezs", "comme", "comment", "contre", "d", "dans", "de", "deja", "déjà",
    "depuis", "des", "donc", "dont", "du", "elle", "elles", "en", "encore", "entre",
    "est", "et", "etaient", "étaient", "etait", "était", "etant", "étant", "etre",
    "être", "eu", "eux", "ici", "il", "ils", "je", "jusque", "jusqu", "l", "la",
    "le", "les", "leur", "leurs", "lui", "ma", "mais", "me", "meme", "même", "mes",
    "mien", "mienne", "moi", "moins", "mon", "ne", "ni", "non", "nos", "notre",
    "nous", "on", "ont", "ou", "où", "oui", "par", "parce", "parmi", "pas", "pendant",
    "peu", "plus", "plusieurs", "pour", "pourquoi", "qu", "quand", "que", "quel",
    "quelle", "quelles", "quels", "qui", "quoi", "s", "sa", "sans", "se", "sera",
    "serait", "ses", "si", "sien", "soi", "soit", "sommes", "son", "sont", "sous",
    "suis", "sur", "t", "ta", "tandis", "te", "tel", "telle", "tes", "toi", "ton",
    "toujours", "tous", "tout", "toute", "toutes", "tres", "très", "trop", "tu",
    "un", "une", "vers", "vos", "votre", "vous", "y", "via",
    # verbes supports / auxiliaires / formes fréquentes
    "avoir", "avais", "avait", "avons", "avez", "avaient", "ayant", "eu", "eue",
    "etre", "être", "suis", "es", "sommes", "etes", "êtes", "etait", "étaient",
    "sera", "seront", "serait", "faire", "fais", "fait", "faite", "faits", "faites",
    "faisait", "font", "faites", "fois", "mettre", "met", "mets", "mettent", "mis",
    "mise", "mises", "peut", "peux", "peuvent", "pouvoir", "pourrait", "pourrait",
    "doit", "dois", "doivent", "devoir", "devrait", "faut", "falloir", "va", "vais",
    "vas", "vont", "aller", "allaient", "allait", "voir", "vois", "voit", "voient",
    "vu", "vue", "dire", "dis", "dit", "dite", "disent", "savoir", "sait", "sais",
    "savent", "suis", "suivre", "prendre", "prend", "pris", "prise", "donne", "donner",
    "donné", "venir", "vient", "venu", "tenir", "tient", "reste", "rester", "reste",
    "passer", "passe", "passé", "arriver", "arrive", "partir", "parti", "semble",
    "sembler", "fallait", "voudrais", "veut", "veux", "vouloir", "voulu",
    # adverbes / interjections / fillers
    "bien", "bon", "bonne", "jamais", "rien", "quelque", "quelques", "surtout",
    "souvent", "parfois", "maintenant", "aujourd", "hui", "demain", "hier", "alors",
    "enfin", "ensuite", "puis", "sinon", "toutefois", "cependant", "pourtant",
    "néanmoins", "neanmoins", "voila", "voilà", "voici", "etc", "bah", "bon",
    "hein", "oui", "non", "ok", "okay", "juste", "vraiment", "assez", "beaucoup",
    "peu", "trop", "aussi", "encore", "deja", "déjà", "toujours", "jamais",
    "pourquoi", "comment", "quand", "combien", "où", "ou",
    # anglais (corpus mixtes / HMPV)
    "the", "and", "for", "with", "this", "that", "are", "was", "were", "been",
    "have", "has", "had", "not", "you", "your", "from", "they", "their", "what",
    "when", "where", "which", "who", "whom", "how", "why", "about", "into", "over",
    "after", "before", "most", "more", "some", "any", "all", "also", "than", "then",
    "there", "here", "just", "like", "can", "could", "would", "should", "will",
    "new", "first", "http", "https", "www", "amp",
}

CSV_BY_CORPUS: dict[str, Path] = {
    "ebola_2_2026": Path(
        r"C:\Users\th8992be\Downloads"
        r"\Export_collecte_ebola_2_collect_20260922_175246_20260101-20260922_full_20260923_091544.csv"
    ),
    "ebola": CROSS_CORPUS_EXPORTS
    / "Export_dl_ebola_corpus_ebola_fr_2014_2026_20260507-20260519_full_20260824_114335.csv",
    "mpox": CROSS_CORPUS_EXPORTS
    / "Export_dl_corpus_mpox_fr_dec2023_janv2026_20240613-20250113_full_20260824_113647.csv",
    "hantavirus": CROSS_CORPUS_EXPORTS
    / "Export_dl_corpus_hantavirus_fr_mai_2026_20260505-20260520_full_20260824_114316.csv",
    "macron_nucleaire": CROSS_CORPUS_EXPORTS
    / "Export_FF_corpus_macron_nucleaire_20260301-20260303_full_20260824_114345.csv",
    "hmpv": CROSS_CORPUS_EXPORTS / "Export_padmen_hmpv_20250101-20250630_full.csv",
    "hmpv_fr": CROSS_CORPUS_EXPORTS / "Export_padmen_hmpv_fr_20250101-20250630_full.csv",
}

# Canicule : partition connectome ≠ profils intercomm → script dédié
#   py -3 build_discourse_canicule.py


def short_label(des: str, max_len: int = 48) -> str:
    s = re.sub(r"\s+", " ", (des or "").strip())
    if len(s) <= max_len:
        return s
    cut = s[: max_len - 3].rsplit(" ", 1)[0]
    return (cut or s[: max_len - 3]) + "..."


def parse_hashtags(val: str, text: str = "") -> set[str]:
    out: set[str] = set()
    if val:
        for part in re.split(r"[,;\s]+", str(val)):
            t = part.strip().lstrip("#").lower()
            if t:
                out.add(t)
    if text:
        out |= {h.lower() for h in re.findall(r"#(\w+)", text, flags=re.UNICODE)}
    return out


def is_retweet(tweet_type: str, text: str) -> bool:
    tt = (tweet_type or "").lower()
    if tt in {"retweet", "rt"}:
        return True
    return (text or "").lstrip().startswith("RT @")


def is_stop_word(w: str) -> bool:
    t = str(w or "").lower().strip()
    return (not t) or t.isdigit() or t in FR_STOP or len(t) < 3


def tokens(text: str) -> list[str]:
    t = URL_RX.sub(" ", text or "")
    t = MENTION_RX.sub(" ", t)
    t = t.replace("#", " ")
    out = []
    for m in TOKEN_RX.findall(t.lower()):
        if is_stop_word(m):
            continue
        out.append(m)
    return out


def weighted_log_odds(n_w, n_c, n_w_ref, n_ref, prior, prior_scale):
    """Monroe et al. 2008 — returns z."""
    a = n_w + prior
    b = n_c + prior_scale - a
    c = n_w_ref + prior
    d = n_ref + prior_scale - c
    if a <= 0 or b <= 0 or c <= 0 or d <= 0:
        return 0.0
    delta = math.log(a / b) - math.log(c / d)
    sigma = math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
    return delta / sigma if sigma > 0 else 0.0


def auto_designation(hub: str, key_hashtags: list[dict], key_words: list[dict]) -> str:
    """Qualification panneau COMMUNAUTÉS — pas de # ni « espace @ » sur le graphe."""
    hub = (hub or "").lstrip("@")
    if key_words:
        return " / ".join(w["word"] for w in key_words[:2])
    if key_hashtags:
        return " / ".join(h["tag"] for h in key_hashtags[:2])
    return f"pôle @{hub}"


def corpus_ids() -> list[str]:
    ids = []
    if MANIFEST.is_file():
        m = json.loads(MANIFEST.read_text(encoding="utf-8"))
        for c in m.get("corpora") or []:
            if c.get("id"):
                ids.append(str(c["id"]))
    if not ids:
        ids = [p.name for p in (CONNECTOME / "data").iterdir() if p.is_dir()]
    # canicule = script dédié
    return [i for i in ids if i != "canicule"]


def stream_csv_full(
    csv_path: Path,
    sn_to_com: dict[str, int],
    focus_ids: set[int],
    *,
    watch_words: set[str] | None = None,
) -> dict:
    """Un seul passage CSV : effectifs # / lemmes, keyness, cooc #, samples.

    Si watch_words est fourni (profils), on ne stocke les comptes lemme
    que pour ces formes — sinon tous les tokens (filtrés plus tard sur keyness).
    """
    ht_c: dict[int, Counter] = defaultdict(Counter)
    tok_c: dict[int, Counter] = defaultdict(Counter)
    n_ht_c: Counter = Counter()
    n_tok_c: Counter = Counter()
    n_own: Counter = Counter()
    samples: dict[int, list[dict]] = defaultdict(list)
    tag_accounts: dict[str, set[str]] = defaultdict(set)
    tag_comm_accounts: dict[str, dict[int, set[str]]] = defaultdict(lambda: defaultdict(set))
    cooccur: dict[str, Counter] = defaultdict(Counter)
    word_accounts: dict[str, set[str]] = defaultdict(set)
    word_comm_accounts: dict[str, dict[int, set[str]]] = defaultdict(lambda: defaultdict(set))
    word_cooccur: dict[str, Counter] = defaultdict(Counter)
    bg_c: dict[int, Counter] = defaultdict(Counter)
    n_bg_c: Counter = Counter()
    bigram_accounts: dict[str, set[str]] = defaultdict(set)
    bigram_comm_accounts: dict[str, dict[int, set[str]]] = defaultdict(
        lambda: defaultdict(set)
    )
    watch = {w.lower() for w in (watch_words or ())} or None

    print(f"  Streaming {csv_path.name} (full enrich)…", flush=True)
    with csv_path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i and i % 200_000 == 0:
                print(f"    …{i:,}", flush=True)
            sn = str(row.get("user_screen_name") or "").lower().lstrip("@")
            if not sn:
                continue
            cid = sn_to_com.get(sn)
            if cid is None:
                continue
            text = row.get("text") or ""
            if is_retweet(row.get("tweet_type") or "", text):
                continue
            if cid in focus_ids:
                n_own[cid] += 1
            tags = parse_hashtags(row.get("hashtag") or "", text)
            for t in tags:
                ht_c[cid][t] += 1
                n_ht_c[cid] += 1
                tag_accounts[t].add(sn)
                tag_comm_accounts[t][cid].add(sn)
            if len(tags) >= 2:
                tag_list = sorted(tags)
                for a_i, ta in enumerate(tag_list):
                    for tb in tag_list[a_i + 1 :]:
                        cooccur[ta][tb] += 1
                        cooccur[tb][ta] += 1
            toks = tokens(text)
            # Dédupliquer dans le message (1 compte / message pour effectifs)
            uniq = list(dict.fromkeys(toks))
            for w in uniq:
                tok_c[cid][w] += 1
                n_tok_c[cid] += 1
                if watch is None or w in watch:
                    word_accounts[w].add(sn)
                    word_comm_accounts[w][cid].add(sn)
            # Bigrammes consécutifs (formes déjà hors stopwords)
            bgs_msg: list[str] = []
            for i in range(len(toks) - 1):
                bg = f"{toks[i]} {toks[i + 1]}"
                bgs_msg.append(bg)
                bg_c[cid][bg] += 1
                n_bg_c[cid] += 1
            for bg in dict.fromkeys(bgs_msg):
                bigram_accounts[bg].add(sn)
                bigram_comm_accounts[bg][cid].add(sn)
            # Co-oc lemmes : uniquement parmi watch (ou top formes si pas de watch)
            if watch is not None:
                wpair = sorted(w for w in uniq if w in watch)
            else:
                wpair = uniq[:12]  # plafond anti-explosion
            if len(wpair) >= 2:
                for a_i, wa in enumerate(wpair):
                    for wb in wpair[a_i + 1 :]:
                        word_cooccur[wa][wb] += 1
                        word_cooccur[wb][wa] += 1
            if cid in focus_ids and len(samples[cid]) < N_SAMPLES + 8:
                tag0 = next(iter(tags), "")
                if len(text.strip()) > 25:
                    samples[cid].append(
                        {
                            "sn": sn,
                            "text": re.sub(r"\s+", " ", text).strip()[:280],
                            "at": str(row.get("created_at") or "")[:10],
                            "tag": tag0,
                        }
                    )

    return {
        "ht_c": ht_c,
        "tok_c": tok_c,
        "n_ht_c": n_ht_c,
        "n_tok_c": n_tok_c,
        "n_own": n_own,
        "samples": samples,
        "tag_accounts": tag_accounts,
        "tag_comm_accounts": tag_comm_accounts,
        "cooccur": cooccur,
        "word_accounts": word_accounts,
        "word_comm_accounts": word_comm_accounts,
        "word_cooccur": word_cooccur,
        "bg_c": bg_c,
        "n_bg_c": n_bg_c,
        "bigram_accounts": bigram_accounts,
        "bigram_comm_accounts": bigram_comm_accounts,
    }


def keyness_bigrams(
    emit_ids: list[int],
    bg_c: dict[int, Counter],
    n_bg_c: Counter,
    *,
    min_n: int = MIN_BG_N,
    z_min: float = Z_BG,
) -> dict[int, list[dict]]:
    universe = sorted(set(bg_c.keys()) | set(n_bg_c.keys()))
    bg_all: Counter = Counter()
    for cid in universe:
        bg_all.update(bg_c.get(cid) or {})
    n_all = sum(int(n_bg_c[c]) for c in universe) or 1
    out: dict[int, list[dict]] = {}
    for cid in emit_ids:
        rest = max(n_all - int(n_bg_c[cid]), 1)
        prior_scale = 80.0
        local = bg_c.get(cid) or Counter()
        scored = []
        for bg, n_w in local.items():
            if n_w < min_n:
                continue
            prior = prior_scale * ((bg_all[bg] + 0.5) / (n_all + 1))
            z = weighted_log_odds(
                n_w, int(n_bg_c[cid]) or 1, bg_all[bg] - n_w, rest, prior, prior_scale
            )
            if z < z_min:
                continue
            scored.append({"bigram": bg, "g2": round(z, 2), "n": int(n_w)})
        scored.sort(key=lambda d: d["g2"], reverse=True)
        if not scored:
            for bg, n_w in local.most_common(N_BIGRAMS):
                if n_w < 1:
                    continue
                scored.append({"bigram": bg, "g2": 0.0, "n": int(n_w)})
        out[cid] = [
            {"bigram": x["bigram"], "g2": x["g2"]} for x in scored[:N_BIGRAMS]
        ]
    return out


def keyness_from_counts(
    emit_ids: list[int],
    ht_c: dict[int, Counter],
    tok_c: dict[int, Counter],
    n_ht_c: Counter,
    n_tok_c: Counter,
    *,
    min_ht_n: int = MIN_HT_N,
    z_ht: float = Z_HT,
) -> dict[int, tuple[list[dict], list[dict], dict]]:
    """Retourne mid → (key_hashtags, key_words, themes).

    Univers statistique = toutes les communautés présentes dans ht_c/tok_c
    (pas seulement les pôles affichés), pour que le z reste informatif
    sur les petits corpus.
    """
    universe_ht = sorted(set(ht_c.keys()) | set(n_ht_c.keys()))
    universe_tok = sorted(set(tok_c.keys()) | set(n_tok_c.keys()))
    ht_all: Counter = Counter()
    tok_all: Counter = Counter()
    for cid in universe_ht:
        ht_all.update(ht_c.get(cid) or {})
    for cid in universe_tok:
        tok_all.update(tok_c.get(cid) or {})
    n_ht_all = sum(int(n_ht_c[c]) for c in universe_ht) or 1
    n_tok_all = sum(int(n_tok_c[c]) for c in universe_tok) or 1

    out: dict[int, tuple[list[dict], list[dict], dict]] = {}
    for cid in emit_ids:
        rest_ht = max(n_ht_all - int(n_ht_c[cid]), 1)
        rest_tok = max(n_tok_all - int(n_tok_c[cid]), 1)
        prior_ht = 80.0
        prior_tok = 80.0

        ht_local = ht_c.get(cid) or Counter()
        tok_local = tok_c.get(cid) or Counter()
        key_hashtags = []
        for h, n_w in ht_local.items():
            if n_w < min_ht_n:
                continue
            prior = prior_ht * ((ht_all[h] + 0.5) / (n_ht_all + 1))
            z = weighted_log_odds(
                n_w, int(n_ht_c[cid]) or 1, ht_all[h] - n_w, rest_ht, prior, prior_ht
            )
            if z < z_ht:
                continue
            key_hashtags.append({"tag": h, "g2": round(z, 2), "n": int(n_w)})
        key_hashtags.sort(key=lambda d: d["g2"], reverse=True)
        # Fallback fréquence si le pôle est trop petit pour le z
        if not key_hashtags:
            for h, n_w in ht_local.most_common(N_TAGS):
                if n_w < 1:
                    continue
                key_hashtags.append({"tag": h, "g2": 0.0, "n": int(n_w)})
        key_hashtags = [
            {"tag": h["tag"], "g2": h["g2"]} for h in key_hashtags[:N_TAGS]
        ]

        key_words = []
        for w, n_w in tok_local.items():
            if n_w < MIN_TERM_N:
                continue
            prior = prior_tok * ((tok_all[w] + 0.5) / (n_tok_all + 1))
            z = weighted_log_odds(
                n_w, int(n_tok_c[cid]) or 1, tok_all[w] - n_w, rest_tok, prior, prior_tok
            )
            if z < Z_TERM:
                continue
            key_words.append({"word": w, "g2": round(z, 2)})
        key_words.sort(key=lambda d: d["g2"], reverse=True)
        if not key_words:
            for w, n_w in tok_local.most_common(N_WORDS):
                if n_w < 2:
                    continue
                key_words.append({"word": w, "g2": 0.0})
        key_words = key_words[:N_WORDS]

        themes: dict = {}
        if key_words:
            mx = max((w["g2"] for w in key_words), default=0) or 1
            for w in key_words[:5]:
                themes[w["word"]] = round(100.0 * max(w["g2"], 0.01) / mx, 1)

        out[cid] = (key_hashtags, key_words, themes)
    return out


def seed_global_tags(
    ordered_ids: list[int],
    tag_accounts: dict[str, set[str]],
    tag_comm_accounts: dict[str, dict[int, set[str]]],
    ht_c: dict[int, Counter],
    n_global: int = 40,
) -> tuple[dict[int, list[dict]], dict[str, set[int]]]:
    """Si aucun # distinctif local : top corpus + attribution aux pôles affichés."""
    ranked = sorted(tag_accounts.items(), key=lambda kv: -len(kv[1]))[:n_global]
    tag_communities: dict[str, set[int]] = defaultdict(set)
    per_com: dict[int, list[dict]] = {mid: [] for mid in ordered_ids}
    focus = set(ordered_ids)
    for t, sns in ranked:
        for cid, accs in (tag_comm_accounts.get(t) or {}).items():
            if cid in focus and accs:
                tag_communities[t].add(cid)
        for mid in ordered_ids:
            n = int((ht_c.get(mid) or {}).get(t) or 0)
            if n > 0:
                per_com[mid].append({"tag": t, "g2": 0.0, "n": n})
    for mid in ordered_ids:
        per_com[mid].sort(key=lambda d: -d["n"])
        per_com[mid] = [{"tag": x["tag"], "g2": x["g2"]} for x in per_com[mid][:N_TAGS]]
        # Si pôle sans # local : coller les top globaux (g2=0) pour peupler le panneau
        if not per_com[mid]:
            per_com[mid] = [{"tag": t, "g2": 0.0} for t, _ in ranked[: min(6, len(ranked))]]
            for h in per_com[mid]:
                tag_communities[h["tag"]].add(mid)
    return per_com, tag_communities


def pack_tag_accounts(
    tag_accounts: dict[str, set[str]],
) -> tuple[dict[str, list[str]], dict[str, int]]:
    stored: dict[str, list[str]] = {}
    counts: dict[str, int] = {}
    for t, sns in sorted(tag_accounts.items()):
        if not sns:
            continue
        counts[t] = len(sns)
        stored[t] = sorted(sns)[:TAG_ACCOUNTS_STORE_CAP]
    return stored, counts


def pack_tag_comm_n(
    tag_comm_accounts: dict[str, dict[int, set[str]]],
    keep: set[str],
) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for t in sorted(keep):
        by = tag_comm_accounts.get(t) or {}
        row = {str(cid): len(sns) for cid, sns in by.items() if sns}
        if row:
            out[t] = dict(sorted(row.items(), key=lambda kv: (-kv[1], kv[0])))
    return out


def pack_tag_cooccur(
    cooccur: dict[str, Counter],
    keep: set[str],
    tag_accounts: dict[str, set[str]],
) -> dict[str, list[dict]]:
    """Top co-occurrents message-level ; stocke aussi les partenaires hors keep (effectifs)."""
    out: dict[str, list[dict]] = {}
    partner_need: set[str] = set()
    for t in sorted(keep):
        ctr = cooccur.get(t) or Counter()
        top = []
        for other, n in ctr.most_common(N_COOC * 2):
            if other == t or n < 2:
                continue
            top.append({"tag": other, "n": int(n)})
            if other not in keep:
                partner_need.add(other)
            if len(top) >= N_COOC:
                break
        if top:
            out[t] = top
    # Garantir tag_accounts pour les partenaires cliquables
    return out, partner_need


def build_one(cid: str) -> Path | None:
    graph_path = CONNECTOME / "data" / cid / "graph.json"
    if not graph_path.is_file():
        print(f"SKIP {cid}: no graph.json", flush=True)
        return None

    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    profiles_path = PROFILES_DIR / f"{cid}_profiles.json"
    by_id: dict[int, dict] = {}
    if profiles_path.is_file():
        profiles = json.loads(profiles_path.read_text(encoding="utf-8"))
        by_id = {int(c["id"]): c for c in profiles.get("communities") or []}
        print(f"{cid}: profiles={len(by_id)}", flush=True)
    else:
        print(f"{cid}: no profiles → keyness CSV si dispo", flush=True)

    sn_to_com: dict[str, int] = {}
    for n in graph.get("nodes") or []:
        sn = str(n.get("l") or "").lower().lstrip("@")
        if sn and n.get("com") is not None:
            sn_to_com[sn] = int(n["com"])

    c90 = (graph.get("meta") or {}).get("communities90") or []
    c90_ids = [int(c["id"]) for c in c90]
    if by_id:
        ordered_ids = list(dict.fromkeys([*by_id.keys(), *c90_ids[:TOP_N_COM_FALLBACK]]))
    else:
        ordered_ids = list(dict.fromkeys(c90_ids[:TOP_N_COM_FALLBACK]))

    focus_ids = set(ordered_ids)
    csv_path = CSV_BY_CORPUS.get(cid)
    csv_file_ok = bool(csv_path and csv_path.is_file())
    # Lemmes à surveiller si profils connus (sinon collecte large + filtre keyness)
    watch_words: set[str] = set()
    if by_id:
        for c in by_id.values():
            for t in (c.get("terms") or [])[:N_WORDS]:
                watch_words.add(str(t["t"]).lower())
    enrich: dict | None = None
    if csv_file_ok:
        enrich = stream_csv_full(
            csv_path,
            sn_to_com,
            focus_ids,
            watch_words=watch_words or None,
        )
        print(
            f"  CSV: {sum(len(s) for s in enrich['tag_accounts'].values()):,} "
            f"compte·tag · {len(enrich['tag_accounts'])} tags · "
            f"{len(enrich['word_accounts'])} lemmes suivis",
            flush=True,
        )
    elif csv_path and not csv_path.is_file():
        print(f"  WARN CSV manquant: {csv_path}", flush=True)

    keyness_map: dict[int, tuple[list[dict], list[dict], dict]] = {}
    # Corpus petit → seuils assouplis
    n_csv_tags = len(enrich["tag_accounts"]) if enrich else 0
    small_corpus = bool(enrich) and n_csv_tags < 800
    if enrich and not by_id:
        keyness_map = keyness_from_counts(
            ordered_ids,
            enrich["ht_c"],
            enrich["tok_c"],
            enrich["n_ht_c"],
            enrich["n_tok_c"],
            min_ht_n=1 if small_corpus else MIN_HT_N,
            z_ht=0.9 if small_corpus else Z_HT,
        )
        n_ht_keys = sum(len(v[0]) for v in keyness_map.values())
        print(
            f"  Keyness CSV: {n_ht_keys} # · "
            f"{sum(len(v[1]) for v in keyness_map.values())} mots"
            + (" (seuils assouplis)" if small_corpus else ""),
            flush=True,
        )
        if n_ht_keys == 0:
            per_com, seeded_tc = seed_global_tags(
                ordered_ids,
                enrich["tag_accounts"],
                enrich["tag_comm_accounts"],
                enrich["ht_c"],
            )
            for mid, tags in per_com.items():
                words = keyness_map.get(mid, ([], [], {}))[1]
                themes = keyness_map.get(mid, ([], [], {}))[2]
                keyness_map[mid] = (tags, words, themes)
            print(
                f"  Fallback fréquence: {sum(len(t) for t in per_com.values())} # "
                f"sur {len(seeded_tc)} tags globaux",
                flush=True,
            )

    overrides = DESIGNATIONS.get(cid) or {}
    communities_out: dict[str, dict] = {}
    tag_communities: dict[str, set[int]] = defaultdict(set)
    word_communities: dict[str, set[int]] = defaultdict(set)
    bigram_communities: dict[str, set[int]] = defaultdict(set)
    tag_accounts: dict[str, set[str]] = defaultdict(set)
    word_accounts: dict[str, set[str]] = defaultdict(set)
    bigram_accounts: dict[str, set[str]] = defaultdict(set)
    bg_keyness: dict[int, list[dict]] = {}
    if enrich:
        tag_accounts = enrich["tag_accounts"]
        word_accounts = enrich["word_accounts"]
        bigram_accounts = enrich["bigram_accounts"]
        bg_keyness = keyness_bigrams(
            ordered_ids,
            enrich["bg_c"],
            enrich["n_bg_c"],
            min_n=1 if small_corpus else MIN_BG_N,
            z_min=0.9 if small_corpus else Z_BG,
        )
        print(
            f"  Bigrammes: {len(bigram_accounts)} uniques · "
            f"{sum(len(v) for v in bg_keyness.values())} distinctifs",
            flush=True,
        )

    for mid in ordered_ids:
        c = by_id.get(mid)
        if c:
            hub = c.get("hub")
            color = c.get("color")
            n_users = int(c.get("nUsers") or 0)
            key_hashtags = [
                {"tag": str(h["t"]).lower(), "g2": float(h.get("z") or 0)}
                for h in (c.get("hashtags") or [])[:N_TAGS]
            ]
            key_words = [
                {"word": str(t["t"]).lower(), "g2": float(t.get("z") or 0)}
                for t in (c.get("terms") or [])
                if not is_stop_word(str(t.get("t") or ""))
            ][:N_WORDS]
            themes = {}
            if key_words:
                mx = max(w["g2"] for w in key_words) or 1
                for w in key_words[:5]:
                    themes[w["word"]] = round(100.0 * w["g2"] / mx, 1)
            n_own = int(
                c.get("nOwnPubs")
                or (enrich["n_own"].get(mid) if enrich else 0)
                or 0
            )
            just = (
                f"C{mid} · hub @{hub}. Lexique distinctif (z vs reste) : "
                + (
                    ", ".join(f"#{h['tag']}" for h in key_hashtags[:4])
                    or ", ".join(w["word"] for w in key_words[:4])
                    or "—"
                )
                + (f". {n_own} pubs hors RT." if n_own else ".")
            )
            samples = (enrich["samples"].get(mid) if enrich else [])[:N_SAMPLES]
        elif mid in keyness_map:
            row = next((r for r in c90 if int(r["id"]) == mid), None)
            hub = (
                ((row.get("accounts") or [{}])[0].get("l") if row else None)
                or f"c{mid}"
            )
            color = row.get("color") if row else None
            n_users = int(row.get("n") or 0) if row else 0
            key_hashtags, key_words, themes = keyness_map[mid]
            n_own = int(enrich["n_own"].get(mid) if enrich else 0) or int(
                (row or {}).get("nPubs") or 0
            )
            just = (
                f"C{mid} · hub @{hub}. Lexique distinctif (z log-odds CSV vs autres pôles) : "
                + (
                    ", ".join(f"#{h['tag']}" for h in key_hashtags[:4])
                    or ", ".join(w["word"] for w in key_words[:4])
                    or "—"
                )
                + (f". {n_own:,} pubs hors RT." if n_own else ".")
            )
            key_tag_set = {h["tag"] for h in key_hashtags}
            smp = (enrich["samples"].get(mid) if enrich else []) or []
            smp_pref = [s for s in smp if s.get("tag") in key_tag_set] or smp
            samples = smp_pref[:N_SAMPLES]
        else:
            row = next((r for r in c90 if int(r["id"]) == mid), None)
            if not row:
                continue
            hub = (row.get("accounts") or [{}])[0].get("l") or f"c{mid}"
            color = row.get("color")
            n_users = int(row.get("n") or 0)
            key_hashtags, key_words, themes = [], [], {}
            n_own = int(row.get("nPubs") or 0)
            just = f"C{mid} · hub @{hub}. Profil lexique non enrichi pour ce pôle."
            samples = []

        des = overrides.get(mid) or auto_designation(str(hub), key_hashtags, key_words)
        for h in key_hashtags:
            tag_communities[h["tag"]].add(mid)
            if not csv_file_ok and hub:
                tag_accounts[h["tag"]].add(str(hub).lower())
        key_words = [w for w in key_words if not is_stop_word(w.get("word"))]
        for w in key_words:
            word_communities[w["word"]].add(mid)
            if not csv_file_ok and hub:
                word_accounts[w["word"]].add(str(hub).lower())
        key_bigrams = list(bg_keyness.get(mid) or [])
        for b in key_bigrams:
            bigram_communities[b["bigram"]].add(mid)

        communities_out[str(mid)] = {
            "id": str(mid),
            "qualif": des,
            "qualif_short": short_label(des),
            "justification": just[:280],
            "key_hashtags": key_hashtags,
            "key_words": key_words,
            "key_bigrams": key_bigrams,
            "themes": themes,
            "samples": samples,
            "n_users": n_users,
            "n_original_tweets": n_own or None,
            "color": color,
            "hub": hub,
        }

    keep = set(tag_communities.keys())
    keep_words = set(word_communities.keys())
    keep_bigrams = set(bigram_communities.keys())
    tag_cooccur: dict[str, list[dict]] = {}
    tag_comm_n: dict[str, dict[str, int]] = {}
    word_cooccur: dict[str, list[dict]] = {}
    word_comm_n: dict[str, dict[str, int]] = {}
    bigram_comm_n: dict[str, dict[str, int]] = {}
    partner_need: set[str] = set()
    word_partner_need: set[str] = set()
    if enrich:
        tag_cooccur, partner_need = pack_tag_cooccur(
            enrich["cooccur"], keep, tag_accounts
        )
        tag_comm_n = pack_tag_comm_n(enrich["tag_comm_accounts"], keep | partner_need)
        keep_store = keep | partner_need
        tag_accounts = {
            t: sns for t, sns in tag_accounts.items() if t in keep_store
        }
        word_cooccur, word_partner_need = pack_tag_cooccur(
            enrich["word_cooccur"], keep_words, word_accounts
        )
        # pack_tag_cooccur utilise clé "tag" — normaliser en "word" pour le JSON lemmes
        word_cooccur = {
            w: [{"word": x["tag"], "n": x["n"]} for x in rows]
            for w, rows in word_cooccur.items()
        }
        word_comm_n = pack_tag_comm_n(
            enrich["word_comm_accounts"], keep_words | word_partner_need
        )
        word_accounts = {
            w: sns
            for w, sns in word_accounts.items()
            if w in (keep_words | word_partner_need)
        }
        # Bigrammes : distinctifs + top global par effectif (panneau Top 50)
        ranked_bg = sorted(
            bigram_accounts.items(), key=lambda kv: -len(kv[1])
        )
        top_bg = {bg for bg, _ in ranked_bg[:BIGRAM_STORE_TOP]}
        keep_bg_store = keep_bigrams | top_bg
        bigram_accounts = {
            bg: sns for bg, sns in bigram_accounts.items() if bg in keep_bg_store
        }
        bigram_comm_n = pack_tag_comm_n(
            enrich["bigram_comm_accounts"], keep_bg_store
        )
        # Compléter bigram_communities pour le top global (pôles où utilisés)
        for bg in top_bg:
            for com_id, sns in (enrich["bigram_comm_accounts"].get(bg) or {}).items():
                if sns and com_id in ordered_ids:
                    bigram_communities[bg].add(com_id)
    else:
        tag_accounts = {t: sns for t, sns in tag_accounts.items() if t in keep}
        word_accounts = {w: sns for w, sns in word_accounts.items() if w in keep_words}
        bigram_accounts = {
            bg: sns for bg, sns in bigram_accounts.items() if bg in keep_bigrams
        }
        bigram_comm_n = {}

    stored, counts = pack_tag_accounts(tag_accounts)
    word_stored, word_counts = pack_tag_accounts(word_accounts)
    bg_stored, bg_counts = pack_tag_accounts(bigram_accounts)

    window = None
    meta_g = graph.get("meta") or {}
    if meta_g.get("window"):
        window = meta_g["window"]

    src_bits = []
    if by_id:
        src_bits.append(f"{cid}_profiles.json")
    elif enrich:
        src_bits.append("keyness CSV (Monroe z)")
    src_bits.append("graph communities90")
    if csv_file_ok:
        src_bits.append(f"CSV enrich # ({csv_path.name})")

    payload = {
        "meta": {
            "cluster": meta_g.get("title") or cid,
            "corpus": cid,
            "window": window,
            "source": " + ".join(src_bits),
            "keyness": (
                "z log-odds (profiles intercomm) vs reste du graphe"
                if by_id
                else (
                    "z log-odds CSV vs autres pôles connectome (Monroe et al. 2008)"
                    if enrich
                    else "désignation hub (profil lexique absent)"
                )
            ),
            "tag_accounts_def": (
                "Comptes du graphe ayant publié hors RT au moins un message "
                "portant le hashtag (champ hashtag + # dans le texte)."
                if csv_file_ok
                else "Fallback hubs (CSV absent)."
            ),
            "tag_cooccur_def": (
                "Co-occurrence message (hors RT) : autres # dans le même message."
                if tag_cooccur
                else None
            ),
            "tag_comm_n_def": (
                "Comptes distincts du graphe ayant utilisé le #, par communauté Louvain."
                if tag_comm_n
                else None
            ),
            "word_accounts_def": (
                "Comptes du graphe ayant publié hors RT au moins un message "
                "contenant la forme lexicale (token hors stop-words)."
                if word_stored
                else None
            ),
            "limit": LIMIT_FR,
        },
        "communities": communities_out,
        "tag_accounts": stored,
        "tag_n_accounts": counts,
        "tag_communities": {
            t: sorted(ids) for t, ids in sorted(tag_communities.items()) if ids
        },
        "tag_cooccur": tag_cooccur,
        "tag_comm_n": tag_comm_n,
        "word_accounts": word_stored,
        "word_n_accounts": word_counts,
        "word_communities": {
            w: sorted(ids) for w, ids in sorted(word_communities.items()) if ids
        },
        "word_cooccur": word_cooccur,
        "word_comm_n": word_comm_n,
        "bigram_accounts": bg_stored,
        "bigram_n_accounts": bg_counts,
        "bigram_communities": {
            b: sorted(ids) for b, ids in sorted(bigram_communities.items()) if ids
        },
        "bigram_comm_n": bigram_comm_n,
    }
    # drop null meta keys
    payload["meta"] = {k: v for k, v in payload["meta"].items() if v is not None}

    out = CONNECTOME / "data" / cid / "discourse.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"  → {out.relative_to(CONNECTOME)} · "
        f"{len(communities_out)} espaces · {len(keep)} # · {len(keep_words)} lemmes · "
        f"{len(bg_counts)} bigrammes · "
        f"nAccL max={max(word_counts.values()) if word_counts else 0} · "
        f"nAccBG max={max(bg_counts.values()) if bg_counts else 0}",
        flush=True,
    )
    return out


def main() -> None:
    ids = corpus_ids()
    only = [a for a in sys.argv[1:] if not a.startswith("-")]
    if only:
        ids = [i for i in ids if i in only]
    print(f"Building discourse for {len(ids)} corpora…", flush=True)
    done = []
    for cid in ids:
        p = build_one(cid)
        if p:
            done.append(cid)

    if MANIFEST.is_file():
        m = json.loads(MANIFEST.read_text(encoding="utf-8"))
        for c in m.get("corpora") or []:
            cid = c.get("id")
            if cid in done or cid == "canicule":
                c["discourseData"] = f"data/{cid}/discourse.json"
        MANIFEST.write_text(
            json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Updated {MANIFEST.name}", flush=True)


if __name__ == "__main__":
    main()
