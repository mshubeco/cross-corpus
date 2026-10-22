# -*- coding: utf-8 -*-
"""Build discourse.json for every CONNECTOME corpus.

Sources (when available):
  - analyses/intercomm/<id>_profiles.json  → hashtags / terms (z)
  - connectome/data/<id>/graph.json        → communities90 + hubs
  - optional CSV for samples (ebola_2_2026 only for now)

Désignations = panneau COMMUNAUTÉS uniquement (pas sur le graphe).
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

ROOT = Path(__file__).resolve().parents[1]
CONNECTOME = Path(__file__).resolve().parent
PROFILES_DIR = ROOT / "analyses" / "intercomm"
MANIFEST = CONNECTOME / "manifest.json"

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

CSV_BY_CORPUS: dict[str, Path] = {
    "ebola_2_2026": Path(
        r"C:\Users\th8992be\Downloads"
        r"\Export_collecte_ebola_2_collect_20260922_175246_20260101-20260922_full_20260923_091544.csv"
    ),
}

# Canicule : partition connectome ≠ profils intercomm → script dédié
#   py -3 build_discourse_canicule.py


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
    return ids


def collect_samples_from_csv(
    csv_path: Path,
    sn_to_com: dict[str, int],
    want_tags: dict[int, set[str]],
) -> tuple[dict[int, list[dict]], dict[str, set[str]], dict[int, int]]:
    samples_by_com: dict[int, list[dict]] = defaultdict(list)
    tag_accounts: dict[str, set[str]] = defaultdict(set)
    n_own_est: dict[int, int] = defaultdict(int)
    all_watch: set[str] = set()
    for s in want_tags.values():
        all_watch |= s

    print(f"  Streaming {csv_path.name}…", flush=True)
    with csv_path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i and i % 200_000 == 0:
                print(f"    …{i:,}", flush=True)
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
            tags |= {h.lower() for h in re.findall(r"#(\w+)", text, flags=re.UNICODE)}
            hit = tags & want_tags[cid]
            if not hit:
                hit = tags & all_watch
            if not hit:
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
    return samples_by_com, tag_accounts, n_own_est


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
        print(f"{cid}: no profiles → hubs communities90 only", flush=True)

    sn_to_com: dict[str, int] = {}
    for n in graph.get("nodes") or []:
        sn = str(n.get("l") or "").lower().lstrip("@")
        if sn and n.get("com") is not None:
            sn_to_com[sn] = int(n["com"])

    c90 = (graph.get("meta") or {}).get("communities90") or []
    c90_ids = [int(c["id"]) for c in c90]
    ordered_ids = list(dict.fromkeys([*by_id.keys(), *c90_ids[:14]]))

    want_tags: dict[int, set[str]] = {}
    for mid, c in by_id.items():
        tags = {str(h["t"]).lower() for h in (c.get("hashtags") or [])[:8]}
        if not tags:
            tags = {str(t["t"]).lower() for t in (c.get("terms") or [])[:3]}
        want_tags[mid] = tags

    samples_by_com: dict[int, list[dict]] = defaultdict(list)
    tag_accounts: dict[str, set[str]] = defaultdict(set)
    n_own_est: dict[int, int] = defaultdict(int)
    csv_path = CSV_BY_CORPUS.get(cid)
    if csv_path and csv_path.is_file() and want_tags:
        samples_by_com, tag_accounts, n_own_est = collect_samples_from_csv(
            csv_path, sn_to_com, want_tags
        )

    overrides = DESIGNATIONS.get(cid) or {}
    communities_out: dict[str, dict] = {}
    tag_communities: dict[str, set[int]] = defaultdict(set)

    for mid in ordered_ids:
        c = by_id.get(mid)
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
            themes = {}
            if key_words:
                mx = max(w["g2"] for w in key_words) or 1
                for w in key_words[:5]:
                    themes[w["word"]] = round(100.0 * w["g2"] / mx, 1)
            n_own = int(c.get("nOwnPubs") or n_own_est.get(mid) or 0)
            just = (
                f"C{mid} · hub @{hub}. Lexique distinctif (z vs reste) : "
                + (
                    ", ".join(f"#{h['tag']}" for h in key_hashtags[:4])
                    or ", ".join(w["word"] for w in key_words[:4])
                    or "—"
                )
                + (f". {n_own} pubs hors RT." if n_own else ".")
            )
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

        des = overrides.get(mid) or auto_designation(str(hub), key_hashtags, key_words)
        for h in key_hashtags:
            tag_communities[h["tag"]].add(mid)
            if hub:
                tag_accounts[h["tag"]].add(str(hub).lower())

        communities_out[str(mid)] = {
            "id": str(mid),
            "qualif": des,
            "qualif_short": short_label(des),
            "justification": just[:280],
            "key_hashtags": key_hashtags,
            "key_words": key_words,
            "themes": themes,
            "samples": (samples_by_com.get(mid) or [])[:5],
            "n_users": n_users,
            "n_original_tweets": n_own or None,
            "color": color,
            "hub": hub,
        }

    window = None
    meta_g = graph.get("meta") or {}
    if meta_g.get("window"):
        window = meta_g["window"]

    payload = {
        "meta": {
            "cluster": meta_g.get("title") or cid,
            "corpus": cid,
            "window": window,
            "source": (
                f"{cid}_profiles.json + graph communities90"
                if by_id
                else "graph communities90 (hubs)"
            ),
            "keyness": "z log-odds (profiles intercomm) vs reste du graphe"
            if by_id
            else "désignation hub (profil lexique absent)",
            "limit": LIMIT_FR,
        },
        "communities": communities_out,
        "tag_accounts": {t: sorted(sns) for t, sns in sorted(tag_accounts.items()) if sns},
        "tag_communities": {
            t: sorted(ids) for t, ids in sorted(tag_communities.items()) if ids
        },
    }

    out = CONNECTOME / "data" / cid / "discourse.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"  → {out.relative_to(CONNECTOME)} · "
        f"{len(communities_out)} espaces · {len(payload['tag_accounts'])} tags",
        flush=True,
    )
    return out


def main() -> None:
    ids = corpus_ids()
    print(f"Building discourse for {len(ids)} corpora…", flush=True)
    done = []
    for cid in ids:
        p = build_one(cid)
        if p:
            done.append(cid)

    # Update manifest discourseData pointers
    if MANIFEST.is_file():
        m = json.loads(MANIFEST.read_text(encoding="utf-8"))
        for c in m.get("corpora") or []:
            cid = c.get("id")
            if cid in done:
                c["discourseData"] = f"data/{cid}/discourse.json"
        MANIFEST.write_text(
            json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Updated {MANIFEST.name}", flush=True)


if __name__ == "__main__":
    main()
