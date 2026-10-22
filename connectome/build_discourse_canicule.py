# -*- coding: utf-8 -*-
"""Discourse CONNECTOME canicule — aligné sur communautés du graph.json.

Les profils intercomm utilisent une autre partition Louvain ; on recalcule
keyness hashtags/termes + échantillons depuis le CSV HEAT et le mapping
écran→communauté du connectome.
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

CONNECTOME = Path(__file__).resolve().parent
GRAPH = CONNECTOME / "data" / "canicule" / "graph.json"
OUT = CONNECTOME / "data" / "canicule" / "discourse.json"
CSV = Path(
    r"C:\Users\th8992be\Desktop\HEAT\01_corpus\exports_github"
    r"\canicule_20260520_20260629\corpus_canicule_20260520_20260629.csv"
)

TOP_N_COM = 12
MIN_HT_N = 8
MIN_TERM_N = 12
Z_HT = 1.6
Z_TERM = 1.85
N_TAGS = 8
N_WORDS = 8
N_SAMPLES = 5

TOKEN_RX = re.compile(r"[a-z0-9àâäéèêëïîôùûüçœæ]{3,}", re.I)
URL_RX = re.compile(r"https?://\S+|t\.co/\S+|www\.\S+", re.I)
MENTION_RX = re.compile(r"@\w+")
FR_STOP = {
    "a", "ai", "alors", "apres", "après", "au", "aucun", "aucune", "aussi", "autre",
    "autres", "aux", "avec", "avoir", "bon", "c", "ca", "car", "ce", "cela", "ces",
    "cet", "cette", "ceux", "chaque", "chez", "comme", "comment", "contre", "d",
    "dans", "de", "deja", "déjà", "depuis", "des", "donc", "dont", "du", "elle",
    "elles", "en", "encore", "entre", "est", "et", "etaient", "etait", "etre",
    "être", "eu", "eux", "fait", "faire", "fais", "faites", "fois", "font", "ici",
    "il", "ils", "je", "juste", "l", "la", "le", "les", "leur", "leurs", "lui",
    "ma", "mais", "me", "meme", "même", "mes", "moi", "mon", "ne", "ni", "nos",
    "notre", "nous", "on", "ont", "ou", "où", "par", "pas", "plus", "pour", "qu",
    "que", "qui", "quoi", "s", "sa", "sans", "se", "sera", "ses", "si", "sien",
    "soi", "sommes", "son", "sont", "sous", "suis", "sur", "t", "ta", "te", "tes",
    "toi", "ton", "tous", "tout", "toute", "toutes", "tres", "très", "tu", "un",
    "une", "vos", "votre", "vous", "y", "via", "the", "and", "for", "http", "https",
    "canicule", "chaleur", "degres", "degrés",  # trop génériques corpus-wide
}

LIMIT_FR = (
    "Label opérationnel fondé sur lexique distinctif (z) / structure / échantillons — "
    "pas une appartenance partisane des comptes ordinaires."
)

# Désignations manuelles (sinon auto depuis # / termes + hub)
DESIGNATIONS: dict[int, str] = {
    10: "Divertissement / télé-réalité",
    0: "Scepticisme climatique / complot",
    14: "Politique LFI × canicule",
    229: "Débat climat / réchauffement",
    546: "Relais presse météo",
    75: "Sport (hors sujet canicule)",
    9: "Alertes météo / Maghreb",
    161: "Twitch / créateurs",
    88: "Contenu adulte / spam",
    49: "Paris sportifs / TV",
    525: "Conversation chaleur",
}


def short_label(des: str, max_len: int = 48) -> str:
    s = re.sub(r"\s+", " ", (des or "").strip())
    if len(s) <= max_len:
        return s
    cut = s[: max_len - 3].rsplit(" ", 1)[0]
    return (cut or s[: max_len - 3]) + "..."


def parse_hashtags(val: str, text: str) -> list[str]:
    tags = []
    if val:
        for part in re.split(r"[,;\s]+", str(val)):
            t = part.strip().lstrip("#").lower()
            if t:
                tags.append(t)
    for h in re.findall(r"#(\w+)", text or "", flags=re.UNICODE):
        tags.append(h.lower())
    return tags


def is_retweet(tweet_type: str, text: str) -> bool:
    tt = (tweet_type or "").lower()
    if tt in {"retweet", "rt"}:
        return True
    return (text or "").lstrip().lower().startswith("rt @")


def tokens(text: str) -> list[str]:
    t = URL_RX.sub(" ", text or "")
    t = MENTION_RX.sub(" ", t)
    t = t.replace("#", " ")
    out = []
    for m in TOKEN_RX.findall(t.lower()):
        if m in FR_STOP or m.isdigit():
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
    """Qualification courte pour le panneau — jamais de # ni « espace @ » (réservé hors graphe)."""
    hub = (hub or "").lstrip("@")
    if key_words:
        return " / ".join(w["word"] for w in key_words[:2])
    if key_hashtags:
        return " / ".join(h["tag"] for h in key_hashtags[:2])
    return f"pôle @{hub}"


def main() -> None:
    print("Loading graph…", flush=True)
    graph = json.loads(GRAPH.read_text(encoding="utf-8"))
    c90 = (graph.get("meta") or {}).get("communities90") or []
    focus_ids = [int(c["id"]) for c in c90[:TOP_N_COM]]
    focus = set(focus_ids)
    hub_by = {
        int(c["id"]): (c.get("accounts") or [{}])[0].get("l") for c in c90 if int(c["id"]) in focus
    }
    color_by = {int(c["id"]): c.get("color") for c in c90 if int(c["id"]) in focus}
    n_users_by = {int(c["id"]): int(c.get("n") or 0) for c in c90 if int(c["id"]) in focus}

    sn_to_com: dict[str, int] = {}
    for n in graph.get("nodes") or []:
        sn = str(n.get("l") or "").lower().lstrip("@")
        com = n.get("com")
        if sn and com is not None and int(com) in focus:
            sn_to_com[sn] = int(com)
    print(f"  focus={focus_ids} mapped_sns={len(sn_to_com):,}", flush=True)

    ht_c: dict[int, Counter] = defaultdict(Counter)
    tok_c: dict[int, Counter] = defaultdict(Counter)
    n_ht_c: Counter = Counter()
    n_tok_c: Counter = Counter()
    n_own: Counter = Counter()
    # reservoir samples keyed by (com, tag)
    samples: dict[int, list[dict]] = defaultdict(list)
    tag_accounts: dict[str, set[str]] = defaultdict(set)

    print(f"Streaming {CSV.name}…", flush=True)
    with CSV.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i and i % 250_000 == 0:
                print(f"  …{i:,}", flush=True)
            sn = str(row.get("user_screen_name") or "").lower().lstrip("@")
            if not sn:
                continue
            cid = sn_to_com.get(sn)
            if cid is None:
                continue
            text = row.get("text") or ""
            if is_retweet(row.get("tweet_type") or "", text):
                continue
            n_own[cid] += 1
            tags = parse_hashtags(row.get("hashtag") or "", text)
            for t in tags:
                ht_c[cid][t] += 1
                n_ht_c[cid] += 1
            for w in tokens(text):
                tok_c[cid][w] += 1
                n_tok_c[cid] += 1
            # keep a few samples (prefer tagged)
            if len(samples[cid]) < N_SAMPLES + 8:
                tag0 = tags[0] if tags else ""
                samples[cid].append(
                    {
                        "sn": sn,
                        "text": re.sub(r"\s+", " ", text).strip()[:280],
                        "at": str(row.get("created_at") or "")[:10],
                        "tag": tag0,
                    }
                )
                for t in tags[:3]:
                    tag_accounts[t].add(sn)

    # global counts over focus communities
    ht_all: Counter = Counter()
    tok_all: Counter = Counter()
    for cid in focus_ids:
        ht_all.update(ht_c[cid])
        tok_all.update(tok_c[cid])
    n_ht_all = sum(n_ht_c.values()) or 1
    n_tok_all = sum(n_tok_c.values()) or 1

    communities_out: dict[str, dict] = {}
    tag_communities: dict[str, set[int]] = defaultdict(set)

    for cid in focus_ids:
        rest_ht = max(n_ht_all - int(n_ht_c[cid]), 1)
        rest_tok = max(n_tok_all - int(n_tok_c[cid]), 1)
        prior_ht = 80.0
        prior_tok = 80.0

        key_hashtags = []
        for h, n_w in ht_c[cid].items():
            if n_w < MIN_HT_N:
                continue
            prior = prior_ht * ((ht_all[h] + 0.5) / (n_ht_all + 1))
            z = weighted_log_odds(
                n_w, int(n_ht_c[cid]) or 1, ht_all[h] - n_w, rest_ht, prior, prior_ht
            )
            if z < Z_HT:
                continue
            key_hashtags.append({"tag": h, "g2": round(z, 2), "n": int(n_w)})
        key_hashtags.sort(key=lambda d: d["g2"], reverse=True)
        key_hashtags = key_hashtags[:N_TAGS]

        key_words = []
        for w, n_w in tok_c[cid].items():
            if n_w < MIN_TERM_N:
                continue
            prior = prior_tok * ((tok_all[w] + 0.5) / (n_tok_all + 1))
            z = weighted_log_odds(
                n_w, int(n_tok_c[cid]) or 1, tok_all[w] - n_w, rest_tok, prior, prior_tok
            )
            if z < Z_TERM:
                continue
            key_words.append({"word": w, "g2": round(z, 2), "n": int(n_w)})
        key_words.sort(key=lambda d: d["g2"], reverse=True)
        key_words = [{"word": x["word"], "g2": x["g2"]} for x in key_words[:N_WORDS]]

        themes = {}
        if key_words:
            mx = max(w["g2"] for w in key_words) or 1
            for w in key_words[:5]:
                themes[w["word"]] = round(100.0 * w["g2"] / mx, 1)

        hub = hub_by.get(cid) or f"c{cid}"
        des = DESIGNATIONS.get(cid) or auto_designation(hub, key_hashtags, key_words)
        # prefer samples that match a key tag
        key_tag_set = {h["tag"] for h in key_hashtags}
        smp = samples.get(cid) or []
        smp_pref = [s for s in smp if s.get("tag") in key_tag_set] or smp
        smp_out = smp_pref[:N_SAMPLES]

        for h in key_hashtags:
            tag_communities[h["tag"]].add(cid)
            tag_accounts[h["tag"]].add(str(hub).lower())

        just = (
            f"C{cid} · hub @{hub}. Lexique distinctif (z log-odds vs autres pôles connectome) : "
            + (
                ", ".join(f"#{h['tag']}" for h in key_hashtags[:4])
                or ", ".join(w["word"] for w in key_words[:4])
                or "—"
            )
            + f". {int(n_own[cid]):,} pubs hors RT."
        )

        communities_out[str(cid)] = {
            "id": str(cid),
            "qualif": des,
            "qualif_short": short_label(des),
            "justification": just[:280],
            "key_hashtags": [{"tag": h["tag"], "g2": h["g2"]} for h in key_hashtags],
            "key_words": key_words,
            "themes": themes,
            "samples": smp_out,
            "n_users": n_users_by.get(cid, 0),
            "n_original_tweets": int(n_own[cid]) or None,
            "color": color_by.get(cid),
            "hub": hub,
        }
        print(
            f"  C{cid} @{hub} · {des} · "
            f"#{len(key_hashtags)} tags · {len(key_words)} words · {len(smp_out)} samples",
            flush=True,
        )

    payload = {
        "meta": {
            "cluster": (graph.get("meta") or {}).get("title") or "Canicule",
            "corpus": "canicule",
            "window": (graph.get("meta") or {}).get("window"),
            "source": "graph.json communities90 + corpus_canicule CSV (keyness z)",
            "keyness": "z log-odds pondéré vs autres pôles du connectome (Monroe et al. 2008)",
            "limit": LIMIT_FR,
        },
        "communities": communities_out,
        "tag_accounts": {
            t: sorted(sns)[:80] for t, sns in sorted(tag_accounts.items()) if sns
        },
        "tag_communities": {
            t: sorted(ids) for t, ids in sorted(tag_communities.items()) if ids
        },
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
