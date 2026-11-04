# -*- coding: utf-8 -*-
"""Photos des comptes les plus visibles, pour le connectome.

FxTwitter répond souvent « introuvable » alors que la photo existe.
On garde son URL quand elle répond, sinon la balise og:image de x.com.
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "data"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
OG = re.compile(
    r'property="og:image" content="(https://pbs\.twimg\.com/profile_images/[^"]+)"'
)
HANDLE = re.compile(r"^[a-z0-9_]{1,15}$")


def candidates(nodes: list) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []

    def add(node: dict) -> None:
        h = str(node.get("l") or "").strip().lstrip("@").lower()
        if not HANDLE.match(h) or h in seen:
            return
        seen.add(h)
        out.append(h)

    ranked = sorted(nodes, key=lambda n: -(float(n.get("deg") or 0)))
    for node in ranked[:500]:
        add(node)
    groups: dict[int, list] = defaultdict(list)
    for node in nodes:
        groups[int(node.get("com") or 0)].append(node)
    for members in groups.values():
        if len(members) < 80:
            continue
        members.sort(key=lambda n: -(float(n.get("deg") or 0)))
        for node in members[:2]:
            add(node)
    return out


def fetch(url: str, headers: dict, timeout: int = 25) -> bytes:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


def from_fxtwitter(handle: str) -> str | None:
    last = None
    for attempt in range(4):
        try:
            raw = fetch(
                f"https://api.fxtwitter.com/{handle}",
                {"User-Agent": UA, "Accept": "application/json"},
            )
            data = json.loads(raw.decode("utf-8", "replace"))
            url = str((data.get("user") or {}).get("avatar_url") or "").strip()
            return url or None
        except urllib.error.HTTPError as err:
            last = err.code
            if err.code == 404 and attempt >= 2:
                return None
            time.sleep(0.4 * (attempt + 1))
        except Exception:
            last = "err"
            time.sleep(0.4 * (attempt + 1))
    if last == 404:
        return None
    return None


def from_x(handle: str) -> str | None:
    try:
        raw = fetch(
            f"https://x.com/{handle}",
            {"User-Agent": "facebookexternalhit/1.1"},
            timeout=30,
        )
    except Exception:
        return None
    match = OG.search(raw.decode("utf-8", "replace"))
    return match.group(1) if match else None


def one(handle: str) -> tuple[str, str | None, str]:
    url = from_fxtwitter(handle)
    if url:
        return handle, url, "fxtwitter"
    url = from_x(handle)
    return handle, url, "x" if url else "miss"


def build(corpus_id: str) -> None:
    path = ROOT / corpus_id / "graph.json"
    print(f"\n=== {corpus_id} ===", flush=True)
    graph = json.loads(path.read_text(encoding="utf-8"))
    handles = candidates(graph["nodes"])
    print(f"  {len(handles)} comptes", flush=True)
    accounts: dict[str, str] = {}
    sources = {"fxtwitter": 0, "x": 0, "miss": 0}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(one, h) for h in handles]
        done = 0
        for fut in as_completed(futures):
            handle, url, source = fut.result()
            done += 1
            sources[source] = sources.get(source, 0) + 1
            if url:
                accounts[handle] = url
            if done % 40 == 0 or done == len(handles):
                print(
                    f"  {done}/{len(handles)} · photos {len(accounts)} "
                    f"· fx {sources['fxtwitter']} · x {sources['x']} · manquantes {sources['miss']}",
                    flush=True,
                )
    out = ROOT / corpus_id / "avatars.json"
    payload = {
        "meta": {
            "source": "api.fxtwitter.com, sinon og:image x.com",
            "n": len(accounts),
            "asked": len(handles),
        },
        "accounts": dict(sorted(accounts.items())),
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  écrit {out}", flush=True)


if __name__ == "__main__":
    import sys

    names = sys.argv[1:] or [
        "canicule",
        "ebola",
        "ebola_2_2026",
        "hantavirus",
        "hmpv",
        "hmpv_fr",
        "macron_nucleaire",
        "mpox",
    ]
    for name in names:
        build(name)
