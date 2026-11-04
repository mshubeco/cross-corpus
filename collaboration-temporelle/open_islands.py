# -*- coding: utf-8 -*-
"""Ouvre les groupes Leiden déjà placés, sans relancer ForceAtlas2.

Le cadre de la page annule un simple zoom global. On agrandit donc chaque
groupe autour de son centre, après avoir ramené les points extrêmes, tant
que les cœurs (rayon 70 %) ne se recouvrent pas.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "data"
CO_RT_MIN = 2


def kept(edge: dict) -> bool:
    other = float(edge.get("ha") or 0) + float(edge.get("me") or 0) + float(edge.get("ur") or 0)
    rt = float(edge.get("rt") or 0)
    if rt > 0 and int(edge.get("rtn") or 0) < CO_RT_MIN:
        rt = 0.0
    return rt + other > 0


def open_corpus(corpus_id: str) -> None:
    path = ROOT / corpus_id / "graph.json"
    graph = json.loads(path.read_text(encoding="utf-8"))
    nodes = graph["nodes"]
    groups: dict[int, list[int]] = defaultdict(list)
    for edge in graph["edges"]:
        if not kept(edge):
            continue
        groups[int(nodes[edge["s"]]["com"])].append(int(edge["s"]))
        groups[int(nodes[edge["t"]]["com"])].append(int(edge["t"]))
    groups = {com: list(dict.fromkeys(ids)) for com, ids in groups.items()}

    cent: dict[int, tuple[float, float]] = {}
    r70: dict[int, float] = {}
    for com, ids in groups.items():
        cx = sum(nodes[i]["x"] for i in ids) / len(ids)
        cy = sum(nodes[i]["y"] for i in ids) / len(ids)
        cent[com] = (cx, cy)
        dists = sorted(
            math.hypot(nodes[i]["x"] - cx, nodes[i]["y"] - cy) for i in ids
        )
        r70[com] = dists[int((len(dists) - 1) * 0.70)] or 1.0

    big = [com for com, ids in groups.items() if len(ids) >= 40]
    scale = 3.2
    for i, a in enumerate(big):
        ax, ay = cent[a]
        for b in big[i + 1 :]:
            dist = math.hypot(ax - cent[b][0], ay - cent[b][1])
            need = (r70[a] + r70[b]) * 1.05
            if need > 1.0:
                scale = min(scale, dist / need)
    scale = max(1.0, scale)
    print(f"{corpus_id}: scale {scale:.2f} · {len(groups)} groupes", flush=True)

    for com, ids in groups.items():
        cx, cy = cent[com]
        cap = r70[com] * 1.45
        for i in ids:
            dx = float(nodes[i]["x"]) - cx
            dy = float(nodes[i]["y"]) - cy
            dist = math.hypot(dx, dy)
            if dist > cap > 0:
                dx *= cap / dist
                dy *= cap / dist
            nodes[i]["x"] = round(cx + dx * scale, 2)
            nodes[i]["y"] = round(cy + dy * scale, 2)

    meta = graph.setdefault("meta", {})
    meta["layout"] = "fa2_spatial_open"
    meta["fa2"] = (
        "ForceAtlas2 à deux échelles, groupes ouverts pour occuper le plan "
        f"(×{scale:.2f}) ; les liens inter-groupes restent en retrait"
    )
    path.write_text(json.dumps(graph, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    method_path = path.parent / "method.json"
    if method_path.exists():
        method = json.loads(method_path.read_text(encoding="utf-8"))
        display = method.setdefault("display", {})
        display["layout"] = meta["layout"]
        display["layout_note"] = meta["fa2"]
        method_path.write_text(json.dumps(method, ensure_ascii=False), encoding="utf-8")
    print(f"  écrit {path}", flush=True)


if __name__ == "__main__":
    import sys

    names = sys.argv[1:] or sorted(p.name for p in ROOT.iterdir() if (p / "graph.json").is_file())
    for name in names:
        open_corpus(name)
