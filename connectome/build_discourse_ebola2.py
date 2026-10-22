# -*- coding: utf-8 -*-
"""Build discourse.json for CONNECTOME ebola_2_2026.

Sources:
  - analyses/intercomm/ebola_2_2026_profiles.json (hashtags/terms distinctifs z)
  - connectome/data/ebola_2_2026/graph.json (membres / communities90)
  - CSV export (échantillons non-RT + comptes par #)
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]  # cross-corpus/
OUT = Path(__file__).resolve().parent / "data" / "ebola_2_2026" / "discourse.json"
PROFILES = ROOT / "analyses" / "intercomm" / "ebola_2_2026_profiles.json"
GRAPH = Path(__file__).resolve().parent / "data" / "ebola_2_2026" / "graph.json"
CSV = Path(
    r"C:\Users\th8992be\Downloads"
    r"\Export_collecte_ebola_2_collect_20260922_175246_20260101-20260922_full_20260923_091544.csv"
)

LIMIT_FR = (
    "Label opérationnel fondé sur lexique distinctif (z) / structure / échantillons — "
    "pas une appartenance partisane des comptes ordinaires."
)

# Désignations courtes opérationnelles (hub + keyness profils)
DESIGNATIONS = {
    12: "Vaccino-critique / peurs épidémiques",
    15: "Alertes & viralité Ebola",
    11: "Info RDC · Nord-Kivu",
    16: "Relais presse / OMS",
    6: "Riposte sanitaire RDC",
    24: "Couverture conflit × Ebola",
}


def short_label(des: str, max_len: int = 48) -> str:
    s = re.sub(r"\s+", " ", (des or "").strip())
    if len(s) <= max_len:
        return s
    cut = s[: max_len - 3].rsplit(" ", 1)[0]
    return (cut or s[: max_len - 3]) + "..."


def parse_hashtags(val: str) -> list[str]:
    if not val:
        return []
    out = []
    for part in re.split(r"[,;\s]+", str(val)):
        t = part.strip().lstrip("#").lower()
        if t:
            out.append(t)
    return out


def is_retweet(tweet_type: str, text: str) -> bool:
    tt = (tweet_type or "").lower()
    if tt in {"retweet", "rt"}:
        return True
    return (text or "").lstrip().startswith("RT @")


def main() -> None:
    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))
    graph = json.loads(GRAPH.read_text(encoding="utf-8"))

    sn_to_com: dict[str, int] = {}
    for n in graph.get("nodes") or []:
        sn = str(n.get("l") or "").lower().lstrip("@")
        if sn and n.get("com") is not None:
            sn_to_com[sn] = int(n["com"])

    by_id = {int(c["id"]): c for c in profiles.get("communities") or []}
    # communities90 order for panel coverage
    c90_ids = [int(c["id"]) for c in (graph.get("meta") or {}).get("communities90") or []]

    want_tags: dict[int, set[str]] = {}
    for cid, c in by_id.items():
        tags = {str(h["t"]).lower() for h in (c.get("hashtags") or [])[:8]}
        # also allow top terms as hashtag fallback for sampling
        if not tags:
            tags = {str(t["t"]).lower() for t in (c.get("terms") or [])[:3]}
        want_tags[cid] = tags

    all_watch = set()
    for s in want_tags.values():
        all_watch |= s

    # Collect samples + tag->accounts (stream CSV once)
    samples_by_com: dict[int, list[dict]] = defaultdict(list)
    tag_accounts: dict[str, set[str]] = defaultdict(set)
    n_own_est: dict[int, int] = defaultdict(int)

    if not CSV.is_file():
        print(f"WARN CSV missing: {CSV}", flush=True)
    else:
        print(f"Streaming {CSV.name}…", flush=True)
        with CSV.open("r", encoding="utf-8", errors="replace", newline="") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i and i % 200_000 == 0:
                    print(f"  …{i:,} rows", flush=True)
                sn = str(row.get("user_screen_name") or "").lower().lstrip("@")
                if not sn:
                    continue
                cid = sn_to_com.get(sn)
                if cid is None or cid not in want_tags:
                    continue
                text = row.get("text") or ""
                if is_retweet(row.get("tweet_type") or "", text):
                    continue
                n_own_est[cid] += 1
                tags = set(parse_hashtags(row.get("hashtag") or ""))
                # also mine # from text
                tags |= {h.lower() for h in re.findall(r"#(\w+)", text, flags=re.UNICODE)}
                hit = tags & want_tags[cid]
                if not hit and all_watch:
                    hit = tags & all_watch
                if not hit:
                    # still keep a few generic non-RT samples per community
                    if len(samples_by_com[cid]) < 2 and len(text.strip()) > 40:
                        samples_by_com[cid].append(
                            {
                                "sn": sn,
                                "text": re.sub(r"\s+", " ", text).strip()[:280],
                                "at": str(row.get("created_at") or "")[:10],
                                "tag": "",
                            }
                        )
                    continue
                tag = sorted(hit)[0]
                for t in hit:
                    tag_accounts[t].add(sn)
                if len(samples_by_com[cid]) < 8:
                    samples_by_com[cid].append(
                        {
                            "sn": sn,
                            "text": re.sub(r"\s+", " ", text).strip()[:280],
                            "at": str(row.get("created_at") or "")[:10],
                            "tag": tag,
                        }
                    )

    communities_out: dict[str, dict] = {}
    tag_communities: dict[str, set[int]] = defaultdict(set)

    # Prefer profiled communities; also stub hubs from communities90 without profile
    ordered_ids = list(dict.fromkeys([*by_id.keys(), *c90_ids[:12]]))

    for cid in ordered_ids:
        c = by_id.get(cid)
        hub = None
        color = None
        n_users = 0
        if c:
            hub = c.get("hub")
            color = c.get("color")
            n_users = int(c.get("nUsers") or 0)
            key_hashtags = [
                {"tag": str(h["t"]).lower(), "g2": float(h.get("z") or 0)}
                for h in (c.get("hashtags") or [])[:8]
            ]
            key_words = [
                {"word": str(t["t"]).lower(), "g2": float(t.get("z") or 0)}
                for t in (c.get("terms") or [])[:8]
            ]
            # themes ≈ top terms normalized
            themes = {}
            if key_words:
                mx = max(w["g2"] for w in key_words) or 1
                for w in key_words[:5]:
                    themes[w["word"]] = round(100.0 * w["g2"] / mx, 1)
            n_own = int(c.get("nOwnPubs") or n_own_est.get(cid) or 0)
            just = (
                f"C{cid} · hub @{hub}. Lexique distinctif (z log-odds vs reste du graphe) : "
                + (
                    ", ".join(f"#{h['tag']}" for h in key_hashtags[:4])
                    or ", ".join(w["word"] for w in key_words[:4])
                    or "—"
                )
                + f". {n_own} pubs hors RT dans le pôle."
            )
        else:
            # stub from communities90
            row = next(
                (r for r in (graph.get("meta") or {}).get("communities90") or [] if int(r["id"]) == cid),
                None,
            )
            if not row:
                continue
            hub = (row.get("accounts") or [{}])[0].get("l") or f"c{cid}"
            color = row.get("color")
            n_users = int(row.get("n") or 0)
            key_hashtags, key_words, themes = [], [], {}
            n_own = int(row.get("nPubs") or 0)
            just = f"C{cid} · hub @{hub}. Profil lexique non encore enrichi pour ce pôle."

        des = DESIGNATIONS.get(cid) or (
            f"{'#' + key_hashtags[0]['tag'] if key_hashtags else (key_words[0]['word'] if key_words else 'espace')} · @{hub}"
        )
        for h in key_hashtags:
            tag_communities[h["tag"]].add(cid)
            # seed hubs into tag_accounts for filter density
            if hub:
                tag_accounts[h["tag"]].add(str(hub).lower())

        communities_out[str(cid)] = {
            "id": str(cid),
            "designation": des,
            "designation_short": short_label(des),
            "justification": just[:280],
            "key_hashtags": key_hashtags,
            "key_words": key_words,
            "themes": themes,
            "samples": (samples_by_com.get(cid) or [])[:5],
            "n_users": n_users,
            "n_original_tweets": n_own or None,
            "color": color,
            "hub": hub,
        }

    payload = {
        "meta": {
            "cluster": "Ebola 2 · 2026",
            "corpus": "ebola_2_2026",
            "window": ["2026-01-01", "2026-09-22"],
            "source": "ebola_2_2026_profiles.json + export CSV",
            "keyness": "z log-odds pondéré (profiles intercomm) vs reste du graphe",
            "limit": LIMIT_FR,
        },
        "communities": communities_out,
        "tag_accounts": {t: sorted(sns) for t, sns in sorted(tag_accounts.items()) if sns},
        "tag_communities": {t: sorted(ids) for t, ids in sorted(tag_communities.items()) if ids},
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"  communities={len(communities_out)} tags={len(payload['tag_accounts'])}")
    for cid, c in list(communities_out.items())[:8]:
        print(
            f"  C{cid} {c['designation_short']} · "
            f"#{len(c['key_hashtags'])} tags · {len(c['samples'])} samples"
        )


if __name__ == "__main__":
    main()
