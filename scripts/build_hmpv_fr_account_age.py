# -*- coding: utf-8 -*-
"""Âge des comptes pour chaque connectome : année snowflake par pseudo du graphe.

Même règle que les profils intercomm : user_id >> 22 + epoch Twitter.
Les identifiants < 2**32, et ceux qui se décodent avant 2010, sont notés 2010
(affiché « ≤2010 »). Au-delà de 2026, l'année est plafonnée à 2026.
"""
from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_ROOT = ROOT.parent / "cross_corpus"
OUT_ROOT = ROOT / "connectome" / "data"
EPOCH_MS = 1288834974657

CORPORA = [
    ("ebola", CSV_ROOT / "Export_dl_ebola_corpus_ebola_fr_2014_2026_20260507-20260519_full_20260824_114335.csv"),
    ("ebola_2_2026", CSV_ROOT / "Export_collecte_ebola_2_collect_20260922_175246_20260101-20260922_full_20260923_091544.csv"),
    ("hantavirus", CSV_ROOT / "Export_dl_corpus_hantavirus_fr_mai_2026_20260505-20260520_full_20260824_114316.csv"),
    ("mpox", CSV_ROOT / "Export_dl_corpus_mpox_fr_dec2023_janv2026_20240613-20250113_full_20260824_113647.csv"),
    ("macron_nucleaire", CSV_ROOT / "Export_FF_corpus_macron_nucleaire_20260301-20260303_full_20260824_114345.csv"),
    ("hmpv", CSV_ROOT / "Export_padmen_hmpv_20250101-20250630_full.csv"),
    ("hmpv_fr", CSV_ROOT / "Export_padmen_hmpv_fr_20250101-20250630_full.csv"),
    (
        "canicule",
        Path(r"C:\Users\th8992be\Desktop\HEAT\01_corpus\exports_github"
             r"\canicule_20260520_20260629\corpus_canicule_20260520_20260629.csv"),
    ),
]

METHOD = (
    "Année reconstituée par l’identifiant Twitter "
    "(user_id ≫ 22 + epoch 1288834974657 ms). "
    "Les identifiants inférieurs à 2³², d’avant le snowflake, sont notés ≤2010. "
    "Pas de date de création dans l’export."
)


def log(msg: str) -> None:
    print(msg, flush=True)


def parse_uid(raw: str) -> int | None:
    text = (raw or "").strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return None
    try:
        uid = int(float(text)) if "." in text else int(text)
    except ValueError:
        return None
    return uid if uid > 0 else None


def snowflake_year(uid: int) -> int | None:
    if uid < 2**32:
        return 2010
    ms = (uid >> 22) + EPOCH_MS
    try:
        year = datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).year
    except (OSError, OverflowError, ValueError):
        return None
    if year < 2010:
        return 2010
    if year > 2026:
        return 2026
    return year


def graph_handles(corpus_id: str) -> list[str]:
    path = OUT_ROOT / corpus_id / "graph.json"
    graph = json.loads(path.read_text(encoding="utf-8"))
    names = []
    seen = set()
    for node in graph["nodes"]:
        name = (node.get("l") or "").strip().lstrip("@").lower()
        if not name or name in seen:
            continue
        seen.add(name)
        names.append(name)
    return names


def ids_for_handles(csv_path: Path, wanted: set[str]) -> tuple[dict[str, int], int]:
    counts: dict[str, Counter] = {}
    with csv_path.open(newline="", encoding="utf-8", errors="replace") as handle:
        for row in csv.DictReader(handle):
            name = (row.get("user_screen_name") or "").strip().lstrip("@").lower()
            if name not in wanted:
                continue
            uid = parse_uid(row.get("user_id") or "")
            if uid is None:
                continue
            bag = counts.get(name)
            if bag is None:
                counts[name] = Counter({uid: 1})
            else:
                bag[uid] += 1
    chosen = {}
    conflict = 0
    for name, bag in counts.items():
        uid, _n = bag.most_common(1)[0]
        if len(bag) > 1:
            conflict += 1
        chosen[name] = uid
    return chosen, conflict


def build_one(corpus_id: str, csv_path: Path) -> None:
    if not csv_path.is_file():
        raise FileNotFoundError(csv_path)
    log(f"{corpus_id}: lecture du graphe")
    names = graph_handles(corpus_id)
    log(f"{corpus_id}: {len(names)} comptes, lecture du CSV")
    chosen, conflict = ids_for_handles(csv_path, set(names))
    years: dict[str, int] = {}
    hist: Counter = Counter()
    undated = 0
    for name in names:
        uid = chosen.get(name)
        if uid is None:
            undated += 1
            continue
        year = snowflake_year(uid)
        if year is None:
            undated += 1
            continue
        years[name] = year
        hist[year] += 1
    payload = {
        "corpus": corpus_id,
        "dated": "2026-10-30",
        "minYear": 2010,
        "maxYear": 2026,
        "preSnowflake": 2010,
        "method": METHOD,
        "n": len(names),
        "nDated": len(years),
        "nNone": undated,
        "nConflict": conflict,
        "hist": {str(year): hist[year] for year in sorted(hist)},
        "a": years,
    }
    out = OUT_ROOT / corpus_id / "account_age.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    bits = " ".join(f"{year}:{hist[year]}" for year in sorted(hist))
    log(f"{corpus_id}: dated {len(years)} none {undated} conflict {conflict} -> {out.name}")
    log(f"  {bits}")


def main() -> None:
    only = set(sys.argv[1:])
    for corpus_id, csv_path in CORPORA:
        if only and corpus_id not in only:
            continue
        build_one(corpus_id, csv_path)


if __name__ == "__main__":
    main()
