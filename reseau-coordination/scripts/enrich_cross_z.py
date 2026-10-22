# -*- coding: utf-8 -*-
"""Ajoute n_cross / z_cross aux nœuds des graphes de coordination.

n_cross = nombre d'AUTRES corpus du site où le compte apparaît aussi
          sur le backbone Serrano.
z_cross = n_cross / (n_corpora - 1)  ∈ [0, 1]
          → profondeur forte = coordination multi-corpus.

Usage: py -3 scripts/enrich_cross_z.py
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def log(msg: str) -> None:
    print(msg, flush=True)


def main() -> None:
    graphs: dict[str, dict] = {}
    presence: dict[str, set[str]] = defaultdict(set)

    for gpath in sorted(DATA.glob("*/graph.json")):
        cid = gpath.parent.name
        data = json.loads(gpath.read_text(encoding="utf-8"))
        graphs[cid] = data
        for n in data.get("nodes") or []:
            sn = str(n.get("l") or "").strip().lstrip("@").lower()
            if sn:
                presence[sn].add(cid)

    corpus_ids = sorted(graphs.keys())
    n_corp = len(corpus_ids)
    denom = max(1, n_corp - 1)
    log(f"{n_corp} corpus · {len(presence):,} comptes uniques backbone")

    multi = sum(1 for s in presence.values() if len(s) > 1)
    log(f"  multi-corpus: {multi:,}")

    index = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "corpora": corpus_ids,
        "nUsers": len(presence),
        "nMulti": multi,
        "definition": (
            "n_cross = nb d'autres corpus où le compte est sur le backbone Serrano ; "
            "z_cross = n_cross / (n_corpora - 1)"
        ),
        "byUser": {u: sorted(cs) for u, cs in sorted(presence.items()) if len(cs) > 1},
    }
    (ROOT / "cross_presence.json").write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    log(f"  écrit cross_presence.json ({multi:,} multi)")

    for cid, data in graphs.items():
        nodes = data.get("nodes") or []
        hist = defaultdict(int)
        for n in nodes:
            sn = str(n.get("l") or "").strip().lstrip("@").lower()
            others = sorted(c for c in presence.get(sn, set()) if c != cid)
            n_cross = len(others)
            n["n_cross"] = n_cross
            n["cross_corpora"] = others
            n["z_cross"] = round(n_cross / denom, 6)
            hist[n_cross] += 1

        meta = data.setdefault("meta", {})
        z_modes = meta.get("zModes") or {}
        z_modes["sync"] = z_modes.get("sync") or {
            "id": "sync",
            "label": "Synchronicité",
            "field": "z_sync",
            "def": "Z = −médiane(Δt) normalisée ; haut = co-RT plus synchrones",
        }
        if any(n.get("z_chrono") is not None for n in nodes):
            z_modes["chrono"] = z_modes.get("chrono") or {
                "id": "chrono",
                "label": "Chronologie",
                "field": "z_chrono",
                "def": "Z = médiane(t_co) normalisée",
            }
        z_modes["cross"] = {
            "id": "cross",
            "label": "Cross-corpus",
            "field": "z_cross",
            "def": (
                "Z = n_cross / (n_corpora−1) ; n_cross = nb d'autres corpus "
                "où le compte est aussi sur le backbone Serrano du site"
            ),
        }
        meta["zModes"] = z_modes
        meta["crossCorpus"] = {
            "nCorpora": n_corp,
            "nMultiOnGraph": sum(1 for n in nodes if (n.get("n_cross") or 0) > 0),
            "histNCross": {str(k): hist[k] for k in sorted(hist)},
            "generatedAt": index["generatedAt"],
        }

        gpath = DATA / cid / "graph.json"
        gpath.write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        mpath = DATA / cid / "meta.json"
        if mpath.exists():
            m = json.loads(mpath.read_text(encoding="utf-8"))
            m["zModes"] = z_modes
            m["crossCorpus"] = meta["crossCorpus"]
            mpath.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        log(f"  {cid}: multi={meta['crossCorpus']['nMultiOnGraph']}/{len(nodes)} · hist={dict(hist)}")

    log("DONE")


if __name__ == "__main__":
    main()
