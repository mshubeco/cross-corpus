# -*- coding: utf-8 -*-
"""Photo, bio et nombre de publications pour chaque compte du réseau de coordination.

Source : api.fxtwitter.com, une fiche par handle, tous corpus confondus.
Le cache reprend là où un passage précédent s'est arrêté.
"""
from __future__ import annotations

import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
CACHE = DATA / "profiles_cache.json"
OUT = DATA / "profiles.json"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
WORKERS = 4


def log(msg: str) -> None:
    print(msg, flush=True)


def handles() -> list[str]:
    found: set[str] = set()
    for path in sorted(DATA.glob("*/graph.json")):
        graph = json.loads(path.read_text(encoding="utf-8"))
        for node in graph.get("nodes") or []:
            handle = str(node.get("l") or "").strip().lstrip("@").lower()
            if handle:
                found.add(handle)
    return sorted(found)


def fetch_json(url: str) -> tuple[int, dict | None]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=25, context=CTX) as response:
            return response.status, json.loads(response.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace") if exc.fp else ""
        try:
            payload = json.loads(body) if body else {}
        except json.JSONDecodeError:
            payload = {}
        return exc.code, payload
    except Exception as exc:
        return 0, {"_error": f"{type(exc).__name__}: {exc}"[:240]}


def scrape(handle: str) -> dict:
    url = f"https://api.fxtwitter.com/{handle}"
    last = "empty"
    not_found = 0
    for attempt in range(5):
        code, data = fetch_json(url)
        if code == 429:
            time.sleep(1.5 * (attempt + 1))
            last = "429"
            continue
        if code == 404:
            not_found += 1
            if not_found >= 3:
                return {"status": "missing"}
            time.sleep(0.6 * not_found)
            last = "404"
            continue
        if code != 200 or not isinstance(data, dict):
            last = str((data or {}).get("_error") or code or "bad")
            time.sleep(0.4 * (attempt + 1))
            continue
        user = data.get("user") if isinstance(data.get("user"), dict) else {}
        if not user:
            last = "no_user"
            time.sleep(0.3)
            continue
        tweets = user.get("tweets")
        try:
            tweets = int(tweets) if tweets is not None else None
        except (TypeError, ValueError):
            tweets = None
        return {
            "status": "ok",
            "name": str(user.get("name") or "").strip(),
            "bio": str(user.get("description") or "").strip(),
            "tweets": tweets,
            "avatar": str(user.get("avatar_url") or "").strip(),
        }
    return {"status": "fail", "error": last}


def publish(cache: dict, wanted: list[str]) -> None:
    accounts = {}
    for handle in wanted:
        rec = cache.get(handle) or {}
        if rec.get("status") != "ok":
            continue
        accounts[handle] = {
            "name": rec.get("name") or "",
            "bio": rec.get("bio") or "",
            "tweets": rec.get("tweets"),
            "avatar": rec.get("avatar") or "",
        }
    payload = {
        "meta": {
            "source": "api.fxtwitter.com",
            "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "nHandles": len(wanted),
            "nProfiles": len(accounts),
        },
        "accounts": accounts,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    wanted = handles()
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    todo = [h for h in wanted if (cache.get(h) or {}).get("status") != "ok"]
    log(f"{len(wanted)} comptes · {len(wanted) - len(todo)} déjà en cache · {len(todo)} à lire")
    done = 0
    if todo:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = {pool.submit(scrape, handle): handle for handle in todo}
            for future in as_completed(futures):
                handle = futures[future]
                try:
                    cache[handle] = future.result()
                except Exception as exc:
                    cache[handle] = {"status": "fail", "error": str(exc)[:200]}
                done += 1
                if done % 40 == 0 or done == len(todo):
                    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
                    ok = sum(1 for h in wanted if (cache.get(h) or {}).get("status") == "ok")
                    log(f"  {done}/{len(todo)} · profils ok {ok}")
        CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    publish(cache, wanted)
    ok = sum(1 for h in wanted if (cache.get(h) or {}).get("status") == "ok")
    missing = sum(1 for h in wanted if (cache.get(h) or {}).get("status") == "missing")
    log(f"écrit {OUT} · ok {ok} · introuvables {missing}")


if __name__ == "__main__":
    main()
