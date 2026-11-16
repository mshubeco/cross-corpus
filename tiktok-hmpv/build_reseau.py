# -*- coding: utf-8 -*-
"""Cartographie des reprises TikTok hMPV.

Relie deux publications quand elles partagent un identificateur exact :
son (music_id), texte hors hashtags, parole, effet, mention, playlist.
Un groupe tenu par un seul compte est une répétition, pas une circulation.
"""
from __future__ import annotations

import importlib.util
import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "reseau.html"
PAGE = ROOT / "build_page.py"
WAVE_START = datetime(2024, 12, 5, tzinfo=timezone.utc)
MONTHS = (
    "janv.", "févr.", "mars", "avr.", "mai", "juin",
    "juil.", "août", "sept.", "oct.", "nov.", "déc.",
)
TAG = re.compile(r"#[^\s#]+")
URL = re.compile(r"https?://\S+|www\.\S+")
SPACE = re.compile(r"\s+")
TYPE_RANK = {
    "parole": 0,
    "texte": 1,
    "son-vague": 2,
    "effet": 3,
    "mention": 4,
    "liste": 5,
    "son-catalogue": 6,
}


def load_page():
    spec = importlib.util.spec_from_file_location("hmpv_page", PAGE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def norm_text(text: str) -> str:
    cleaned = TAG.sub(" ", text or "")
    cleaned = URL.sub(" ", cleaned)
    cleaned = unicodedata.normalize("NFKD", cleaned)
    cleaned = "".join(ch for ch in cleaned if not unicodedata.combining(ch))
    cleaned = cleaned.lower().replace("'", "'")
    cleaned = re.sub(r"[^\w\s']", " ", cleaned, flags=re.UNICODE)
    return SPACE.sub(" ", cleaned).strip()


def fmt_day(moment: datetime) -> str:
    return f"{moment.day} {MONTHS[moment.month - 1]} {moment.year}"


def sound_date(music_id: str) -> datetime | None:
    try:
        stamp = int(music_id) >> 32
    except ValueError:
        return None
    if stamp < 1_400_000_000 or stamp > 1_900_000_000:
        return None
    return datetime.fromtimestamp(stamp, tz=timezone.utc)


def clip(text: str, size: int) -> str:
    text = SPACE.sub(" ", (text or "").strip())
    if len(text) <= size:
        return text
    return text[: size - 1].rstrip() + "…"


class UnionFind:
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}

    def add(self, item: str) -> None:
        self.parent.setdefault(item, item)

    def find(self, item: str) -> str:
        root = item
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[item] != root:
            self.parent[item], item = root, self.parent[item]
        return root

    def union(self, left: str, right: str) -> None:
        self.add(left)
        self.add(right)
        ra, rb = self.find(left), self.find(right)
        if ra != rb:
            self.parent[rb] = ra


def build() -> dict:
    page = load_page()
    rows = page.records()
    by_id = {row["id"]: row for row in rows}
    raw = {}
    for line in page.SRC.read_text(encoding="utf-8").splitlines():
        if line.strip():
            item = json.loads(line)
            raw[str(item["id"])] = item

    groups: list[tuple[str, str, list[str]]] = []

    music_bag: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        music_id = str(raw[row["id"]].get("music_id") or "")
        if music_id and music_id != "0":
            music_bag[music_id].append(row["id"])
    for music_id, ids in music_bag.items():
        if len(ids) < 2:
            continue
        moment = sound_date(music_id)
        if moment and moment >= WAVE_START:
            kind = "son-vague"
            label = f"Son du {fmt_day(moment)}"
        elif moment:
            kind = "son-catalogue"
            label = f"Musique de catalogue, {fmt_day(moment)}"
        else:
            kind = "son-catalogue"
            label = "Musique de catalogue"
        groups.append((kind, label, ids))

    text_bag: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        key = norm_text(row["desc"])
        if len(key) >= 18:
            text_bag[key].append(row["id"])
    for key, ids in text_bag.items():
        if len(ids) >= 2:
            groups.append(("texte", clip(key, 140), ids))

    voice_bag: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        key = norm_text(row["voice"])
        if len(key) >= 30:
            voice_bag[key].append(row["id"])
    for key, ids in voice_bag.items():
        if len(ids) >= 2:
            groups.append(("parole", clip(key, 140), ids))

    effect_bag: dict[str, list[str]] = defaultdict(list)
    mention_bag: dict[tuple[str, ...], list[str]] = defaultdict(list)
    playlist_bag: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        item = raw[row["id"]]
        for effect in item.get("effect_ids") or []:
            if effect:
                effect_bag[str(effect)].append(row["id"])
        mentions = tuple(sorted(str(name).strip() for name in (item.get("video_mention_list") or []) if str(name).strip()))
        if mentions:
            mention_bag[mentions].append(row["id"])
        playlist = str(item.get("playlist_id") or "")
        if playlist and playlist != "0":
            playlist_bag[playlist].append(row["id"])
    for effect, ids in effect_bag.items():
        if len(ids) >= 2:
            groups.append(("effet", f"Effet TikTok {effect}", ids))
    for mentions, ids in mention_bag.items():
        if len(ids) >= 2:
            groups.append(("mention", clip(" · ".join(mentions), 140), ids))
    for playlist, ids in playlist_bag.items():
        if len(ids) >= 2:
            groups.append(("liste", f"Playlist {playlist}", ids))

    uf = UnionFind()
    pair_details: dict[tuple[str, str], list[tuple[str, str]]] = defaultdict(list)
    for kind, label, ids in groups:
        ordered = sorted(set(ids))
        for video_id in ordered:
            uf.add(video_id)
        for i, left in enumerate(ordered):
            for right in ordered[i + 1:]:
                uf.union(left, right)
                pair = (left, right) if left < right else (right, left)
                pair_details[pair].append((kind, label))

    members: dict[str, list[str]] = defaultdict(list)
    for video_id in uf.parent:
        members[uf.find(video_id)].append(video_id)

    components = []
    piles = []
    drawn_ids: set[str] = set()
    for root, ids in members.items():
        ids = sorted(ids, key=lambda video_id: by_id[video_id]["at"])
        accounts = sorted({by_id[video_id]["user"] for video_id in ids})
        labels: dict[tuple[str, str], int] = defaultdict(int)
        types: set[str] = set()
        for i, left in enumerate(ids):
            for right in ids[i + 1:]:
                pair = (left, right) if left < right else (right, left)
                for kind, label in pair_details.get(pair, []):
                    labels[(kind, label)] += 1
                    types.add(kind)
        best = max(labels, key=lambda item: (labels[item], -TYPE_RANK[item[0]]))
        title = best[1]
        eng = sum(by_id[video_id]["likes"] + by_id[video_id]["comments"] + by_id[video_id]["shares"] for video_id in ids)
        mis = sum(1 for video_id in ids if by_id[video_id]["mis"])
        record = {
            "id": root,
            "title": title,
            "kind": best[0],
            "types": sorted(types, key=lambda kind: TYPE_RANK[kind]),
            "accounts": accounts,
            "ids": ids,
            "eng": eng,
            "mis": mis,
        }
        if len(accounts) >= 2:
            components.append(record)
            drawn_ids.update(ids)
        else:
            piles.append(record)

    components.sort(key=lambda item: (-len(item["accounts"]), -item["eng"], item["title"]))
    piles.sort(key=lambda item: (-len(item["ids"]), -item["eng"]))

    edges = []
    seen = set()
    for pair, details in pair_details.items():
        left, right = pair
        if left not in drawn_ids or right not in drawn_ids:
            continue
        if uf.find(left) != uf.find(right):
            continue
        kinds = []
        labels = []
        for kind, label in details:
            if kind not in kinds:
                kinds.append(kind)
                labels.append(label)
        kinds.sort(key=lambda kind: TYPE_RANK[kind])
        key = (left, right, tuple(kinds))
        if key in seen:
            continue
        seen.add(key)
        edges.append({"a": left, "b": right, "types": kinds, "labels": labels})

    def public_node(row: dict) -> dict:
        return {
            "id": row["id"],
            "user": row["user"],
            "at": row["at"],
            "desc": row["desc"],
            "voice": row["voice"],
            "fr": row["fr"],
            "lang": row["lang"],
            "views": row["views"],
            "likes": row["likes"],
            "comments": row["comments"],
            "shares": row["shares"],
            "mis": row["mis"],
            "why": row["why"],
        }

    keep = drawn_ids | {video_id for pile in piles for video_id in pile["ids"]}
    nodes = [public_node(by_id[video_id]) for video_id in sorted(keep, key=lambda video_id: by_id[video_id]["at"])]
    linked = len(keep)
    return {
        "meta": {
            "videos": len(rows),
            "linked": linked,
            "circulations": len(components),
            "piles": len(piles),
            "isolates": len(rows) - linked,
            "edges": len(edges),
            "mis": sum(1 for row in rows if row["mis"]),
        },
        "nodes": nodes,
        "edges": edges,
        "components": [
            {key: value for key, value in item.items() if key != "ids"} | {"ids": item["ids"]}
            for item in components
        ],
        "piles": piles,
    }


TEMPLATE = r"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reprises · TikTok hMPV</title>
<style>
  :root {
    --bg: #f3f5f9;
    --ink: #1c2434;
    --muted: #7c8696;
    --line: #d5dce8;
    --card: #ffffff;
    --accent: #3d6fbe;
    --mis: #d23b4a;
    --mis-bg: #fff1f2;
    --mis-ink: #8d2433;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--ink);
    font-family: Aptos, "Segoe UI", "Helvetica Neue", sans-serif;
  }
  button, input { font: inherit; color: inherit; }
  a { color: var(--accent); }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    align-items: end;
    justify-content: space-between;
    padding: 14px 18px 10px;
    background: rgba(243, 245, 249, 0.96);
    border-bottom: 1px solid #e6ebf3;
  }
  h1 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: -0.01em; }
  .sub, .note { margin: 3px 0 0; color: var(--muted); font-size: 13px; line-height: 1.4; }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  input[type="search"] {
    height: 36px;
    width: min(280px, 70vw);
    padding: 0 10px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .filters { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; padding: 8px 18px; background: var(--card); border-bottom: 1px solid var(--line); }
  .filters label { display: flex; gap: 6px; align-items: center; font-size: 13px; cursor: pointer; }
  .swatch { width: 18px; height: 3px; border-radius: 2px; display: inline-block; }
  .dotswatch { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  #app { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); }
  aside { overflow: auto; border-right: 1px solid var(--line); background: #eef2f8; }
  #count { margin: 0; padding: 10px 12px 6px; color: var(--muted); font-size: 12px; line-height: 1.4; }
  #list { display: flex; flex-direction: column; gap: 6px; padding: 0 10px 16px; }
  .comp {
    text-align: left;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 10px;
    cursor: pointer;
  }
  .comp.on { border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent); }
  .comp b { display: block; font-size: 13px; font-weight: 650; line-height: 1.35; }
  .comp span { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; }
  h2 { margin: 14px 12px 6px; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
  #mapwrap { overflow: auto; background:
    linear-gradient(#e7edf5 1px, transparent 1px),
    linear-gradient(90deg, #e7edf5 1px, transparent 1px);
    background-size: 28px 28px;
    background-color: #f7f9fc;
  }
  svg { display: block; }
  .node, .comp { cursor: pointer; }
  #detail {
    display: none;
    border-top: 1px solid var(--line);
    background: var(--card);
    padding: 12px 18px 16px;
    max-height: 38vh;
    overflow: auto;
  }
  #detail.open { display: block; }
  #detail h3 { margin: 0 0 4px; font-size: 16px; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 14px; color: var(--muted); font-size: 13px; }
  .flag { display: inline-block; margin: 8px 0; padding: 6px 8px; background: var(--mis-bg); color: var(--mis-ink); border-radius: 6px; font-size: 13px; }
  .desc, .said { margin: 8px 0 0; white-space: pre-wrap; line-height: 1.45; font-size: 14px; }
  .rels { margin: 8px 0 0; padding: 0; list-style: none; }
  .rels li { margin: 0 0 4px; font-size: 13px; color: #3c4656; }
  .pile button { display: block; width: 100%; text-align: left; background: transparent; border: 0; padding: 4px 0; cursor: pointer; color: var(--accent); }
  @media (max-width: 860px) {
    #app { grid-template-columns: 1fr; }
    aside { max-height: 34vh; border-right: 0; border-bottom: 1px solid var(--line); }
  }
</style>
</head>
<body>
<header>
  <div>
    <h1>Reprises · TikTok hMPV</h1>
    <p class="sub">Publications reliées par un identificateur commun. <a href="index.html">Retour à la frise</a></p>
  </div>
  <div class="tools">
    <input id="q" type="search" placeholder="Compte, texte, parole" aria-label="Chercher dans la carte">
  </div>
</header>
<p class="note" style="padding: 8px 18px 0">Le trait relie deux vidéos qui ont le même son, le même texte une fois les hashtags retirés, la même parole, le même effet ou la même mention. La taille du point suit les engagements. Le rouge reprend le filtre lexical de la frise. Un groupe d’un seul compte est listé à part.</p>
<div class="filters" id="filters">
  <label><input type="checkbox" value="son-vague" checked><i class="swatch" style="background:#3d6fbe"></i>Son de la vague</label>
  <label><input type="checkbox" value="son-catalogue" checked><i class="swatch" style="background:#9bb0c9"></i>Musique de catalogue</label>
  <label><input type="checkbox" value="texte" checked><i class="swatch" style="background:#0e8a6a"></i>Même texte</label>
  <label><input type="checkbox" value="parole" checked><i class="swatch" style="background:#7a4ea3"></i>Même parole</label>
  <label><input type="checkbox" value="effet" checked><i class="swatch" style="background:#c47b12"></i>Même effet</label>
  <label><input type="checkbox" value="mention" checked><i class="swatch" style="background:#5c6778"></i>Même mention</label>
  <label><input type="checkbox" value="liste" checked><i class="swatch" style="background:#8a6a4a"></i>Même playlist</label>
  <span><i class="dotswatch" style="background:#d23b4a"></i> mésinformation susceptible</span>
  <span><i class="dotswatch" style="background:#5c6b82"></i> autre</span>
</div>
<div id="app">
  <aside>
    <p id="count"></p>
    <h2>Circulation entre comptes</h2>
    <div id="list"></div>
    <h2>Répétition d’un seul compte</h2>
    <div id="piles"></div>
  </aside>
  <div id="mapwrap"><svg id="map" role="img" aria-label="Carte des reprises"></svg></div>
</div>
<section id="detail"></section>
<script>
const DATA = /*__DATA__*/;
const TYPE_COLOR = {
  parole: "#7a4ea3",
  texte: "#0e8a6a",
  "son-vague": "#3d6fbe",
  effet: "#c47b12",
  mention: "#5c6778",
  liste: "#8a6a4a",
  "son-catalogue": "#9bb0c9"
};
const TYPE_NAME = {
  parole: "même parole",
  texte: "même texte",
  "son-vague": "son de la vague",
  effet: "même effet",
  mention: "même mention",
  liste: "même playlist",
  "son-catalogue": "musique de catalogue"
};
const nf = new Intl.NumberFormat("fr-FR");
const df = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  timeZone: "Europe/Paris"
});
const byId = new Map(DATA.nodes.map((node) => [node.id, node]));
const qEl = document.getElementById("q");
const listEl = document.getElementById("list");
const pilesEl = document.getElementById("piles");
const countEl = document.getElementById("count");
const mapEl = document.getElementById("map");
const wrapEl = document.getElementById("mapwrap");
const detailEl = document.getElementById("detail");
const filterEls = [...document.querySelectorAll("#filters input")];
let activeComp = "";
let activeId = "";
let placed = new Map();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}
function engagement(node) {
  return (node.likes || 0) + (node.comments || 0) + (node.shares || 0);
}
function when(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : df.format(date);
}
function activeTypes() {
  return new Set(filterEls.filter((el) => el.checked).map((el) => el.value));
}
function edgeOn(edge, types) {
  return edge.types.some((type) => types.has(type));
}
function query() {
  return qEl.value.trim().toLowerCase();
}
function matches(node) {
  const q = query();
  if (!q) return true;
  return (node.user + "\n" + node.desc + "\n" + node.voice + "\n" + (node.fr || "")).toLowerCase().includes(q);
}
function radius(node) {
  const maxEng = Math.max(1, ...DATA.nodes.map(engagement));
  const t = Math.log1p(engagement(node)) / Math.log1p(maxEng);
  return 5 + t * 9;
}
function leadType(edge) {
  return edge.types.find((type) => activeTypes().has(type)) || edge.types[0];
}

function boxSize(count) {
  if (count <= 2) return [220, 140];
  if (count <= 4) return [300, 210];
  if (count <= 8) return [420, 300];
  const side = Math.round(280 + count * 22);
  return [side, Math.round(side * 0.78)];
}

function layoutCircle(ids, width, height) {
  return ids.map((id, i) => {
    const angle = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
    return {
      x: width / 2 + Math.cos(angle) * (width / 2 - 46),
      y: height / 2 + Math.sin(angle) * (height / 2 - 28)
    };
  });
}

function isDense(comp) {
  const count = comp.ids.length;
  if (count < 6) return false;
  const links = DATA.edges.filter((edge) => comp.ids.includes(edge.a) && comp.ids.includes(edge.b)).length;
  return links >= count * 2;
}

function layoutForce(ids, edges, width, height) {
  const index = new Map(ids.map((id, i) => [id, i]));
  const pos = ids.map((id, i) => {
    const angle = (i / ids.length) * Math.PI * 2;
    return {
      x: width / 2 + Math.cos(angle) * width * 0.28,
      y: height / 2 + Math.sin(angle) * height * 0.28
    };
  });
  if (ids.length === 1) return [{ x: width / 2, y: height / 2 }];
  if (ids.length === 2) return [{ x: width * 0.32, y: height / 2 }, { x: width * 0.68, y: height / 2 }];
  const links = edges.filter((edge) => index.has(edge.a) && index.has(edge.b));
  for (let step = 0; step < 220; step++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const force = 1400 / (dist * dist);
        dx /= dist; dy /= dist;
        disp[i].x += dx * force; disp[i].y += dy * force;
        disp[j].x -= dx * force; disp[j].y -= dy * force;
      }
    }
    for (const edge of links) {
      const i = index.get(edge.a);
      const j = index.get(edge.b);
      const dx = pos[j].x - pos[i].x;
      const dy = pos[j].y - pos[i].y;
      disp[i].x += dx * 0.045;
      disp[i].y += dy * 0.045;
      disp[j].x -= dx * 0.045;
      disp[j].y -= dy * 0.045;
    }
    const cool = 0.85 * (1 - step / 240);
    for (let i = 0; i < pos.length; i++) {
      pos[i].x = Math.min(width - 22, Math.max(22, pos[i].x + disp[i].x * cool));
      pos[i].y = Math.min(height - 16, Math.max(16, pos[i].y + disp[i].y * cool));
    }
  }
  return pos;
}

function layoutGrid(ids, width, height) {
  const cols = Math.ceil(Math.sqrt(ids.length));
  const rows = Math.ceil(ids.length / cols);
  return ids.map((id, i) => ({
    x: ((i % cols) + 0.5) * (width / cols),
    y: (Math.floor(i / cols) + 0.5) * (height / rows)
  }));
}

function prepare() {
  const gap = 36;
  const maxW = Math.max(860, wrapEl.clientWidth || 860);
  let x = 20;
  let y = 20;
  let rowH = 0;
  placed = new Map();
  const boxes = [];
  for (const comp of DATA.components) {
    const [w, h] = boxSize(comp.ids.length);
    const boxW = w + 24;
    const boxH = h + 42;
    if (x > 20 && x + boxW > maxW) {
      x = 20;
      y += rowH + gap;
      rowH = 0;
    }
    const localEdges = DATA.edges.filter((edge) => comp.ids.includes(edge.a) && comp.ids.includes(edge.b));
    const local = comp.ids.length >= 6
      ? layoutCircle(comp.ids, w, h)
      : layoutForce(comp.ids, localEdges, w, h);
    comp.ids.forEach((id, i) => {
      placed.set(id, { x: x + 12 + local[i].x, y: y + 32 + local[i].y, comp: comp.id });
    });
    boxes.push({ comp, x, y, w: boxW, h: boxH });
    x += boxW + gap;
    rowH = Math.max(rowH, boxH);
  }
  return { boxes, width: Math.max(maxW, x + 20), height: y + rowH + 24 };
}

function renderList() {
  const meta = DATA.meta;
  countEl.textContent = meta.circulations + " circulations entre comptes · " + meta.piles + " répétitions d’un seul compte · " + meta.isolates + " publications sans identificateur partagé, sur " + meta.videos + ".";
  listEl.innerHTML = DATA.components.map((comp) => `
    <button type="button" class="comp${comp.id === activeComp ? " on" : ""}" data-comp="${comp.id}">
      <b>${escapeHtml(comp.title)}</b>
      <span>${comp.accounts.length} comptes · ${comp.ids.length} vidéos · ${comp.types.map((type) => TYPE_NAME[type]).join(", ")}${comp.mis ? " · " + comp.mis + " en rouge" : ""} · ${nf.format(comp.eng)} engagements</span>
    </button>`).join("");
  pilesEl.innerHTML = DATA.piles.map((pile) => `
    <article class="comp pile">
      <b>@${escapeHtml(pile.accounts[0])} · ${pile.ids.length} vidéos</b>
      <span>${escapeHtml(pile.title)}</span>
      <span>${pile.mis ? pile.mis + " en rouge · " : ""}${nf.format(pile.eng)} engagements</span>
      ${pile.ids.map((id) => {
        const node = byId.get(id);
        return `<button type="button" data-id="${id}">${escapeHtml(when(node.at))} · ${nf.format(node.views)} vues</button>`;
      }).join("")}
    </article>`).join("");
}

function renderMap() {
  const types = activeTypes();
  const scene = prepare();
  const parts = [];
  for (const box of scene.boxes) {
    const on = box.comp.id === activeComp;
    parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="10" fill="#ffffff" stroke="${on ? "#3d6fbe" : "#d5dce8"}"></rect>`);
    parts.push(`<text x="${box.x + 12}" y="${box.y + 20}" fill="#1c2434" font-size="12" font-family="Aptos, Segoe UI, sans-serif">${escapeHtml(clipTitle(box.comp.title, box.w))}</text>`);
  }
  for (const comp of DATA.components) {
    const compEdges = DATA.edges.filter((edge) => edgeOn(edge, types) && comp.ids.includes(edge.a) && comp.ids.includes(edge.b));
    if (isDense(comp)) {
      if (!compEdges.length) continue;
      const pts = comp.ids.map((id) => placed.get(id)).filter(Boolean);
      if (!pts.length) continue;
      const cx = pts.reduce((sum, pt) => sum + pt.x, 0) / pts.length;
      const cy = pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length;
      const hub = TYPE_COLOR[comp.kind] || "#9bb0c9";
      for (const id of comp.ids) {
        const at = placed.get(id);
        if (!at) continue;
        parts.push(`<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${at.x.toFixed(1)}" y2="${at.y.toFixed(1)}" stroke="${hub}" stroke-width="1.2" stroke-opacity="0.55"><title>${escapeHtml(comp.title)}</title></line>`);
      }
      for (const edge of compEdges) {
        const extra = edge.types.filter((type) => type !== comp.kind);
        if (!extra.length) continue;
        const a = placed.get(edge.a);
        const b = placed.get(edge.b);
        if (!a || !b) continue;
        parts.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${TYPE_COLOR[extra[0]]}" stroke-width="1.8" stroke-opacity="0.9"><title>${escapeHtml(edge.labels.join(" · "))}</title></line>`);
      }
      continue;
    }
    for (const edge of compEdges) {
      const a = placed.get(edge.a);
      const b = placed.get(edge.b);
      if (!a || !b) continue;
      const type = leadType(edge);
      const dim = query() && !(matches(byId.get(edge.a)) || matches(byId.get(edge.b))) ? 0.12 : 0.9;
      parts.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${TYPE_COLOR[type]}" stroke-width="${edge.types.length > 1 ? 2.2 : 1.3}" stroke-opacity="${dim}"><title>${escapeHtml(edge.labels.join(" · "))}</title></line>`);
    }
  }
  for (const comp of DATA.components) {
    for (const id of comp.ids) {
      const node = byId.get(id);
      const at = placed.get(id);
      if (!at) continue;
      const visible = [...comp.ids].some((other) => other !== id && DATA.edges.some((edge) => edgeOn(edge, types) && ((edge.a === id && edge.b === other) || (edge.b === id && edge.a === other))));
      const hit = matches(node);
      const fade = (!visible || (query() && !hit)) ? 0.18 : 1;
      const fill = node.mis ? "#d23b4a" : "#5c6b82";
      const stroke = id === activeId ? ' stroke="#1c2434" stroke-width="1.8"' : "";
      const r = radius(node).toFixed(1);
      parts.push(`<circle class="node" data-id="${id}" cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${r}" fill="${fill}" fill-opacity="${fade}"${stroke}><title>@${escapeHtml(node.user)} · ${escapeHtml(when(node.at))} · ${nf.format(engagement(node))} engagements</title></circle>`);
      if (comp.ids.length <= 8) {
        parts.push(`<text x="${(at.x + Number(r) + 3).toFixed(1)}" y="${(at.y + 3).toFixed(1)}" fill="#3c4656" fill-opacity="${fade}" font-size="10" font-family="Aptos, Segoe UI, sans-serif">@${escapeHtml(node.user)}</text>`);
      }
    }
  }
  mapEl.setAttribute("viewBox", `0 0 ${scene.width} ${scene.height}`);
  mapEl.setAttribute("width", String(scene.width));
  mapEl.setAttribute("height", String(scene.height));
  mapEl.innerHTML = parts.join("");
}

function clipTitle(text, width) {
  const max = Math.max(18, Math.floor((width - 24) / 7));
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function relations(id) {
  const types = activeTypes();
  return DATA.edges.filter((edge) => edgeOn(edge, types) && (edge.a === id || edge.b === id)).map((edge) => {
    const other = byId.get(edge.a === id ? edge.b : edge.a);
    return { other, edge };
  });
}

function showNode(id) {
  const node = byId.get(id);
  if (!node) return;
  activeId = id;
  const comp = DATA.components.find((item) => item.ids.includes(id));
  activeComp = comp ? comp.id : "";
  const rels = relations(id).map(({ other, edge }) =>
    `<li><b>${escapeHtml(edge.types.map((type) => TYPE_NAME[type]).join(", "))}</b> — @${escapeHtml(other.user)} · ${escapeHtml(edge.labels[0] || "")}</li>`
  ).join("");
  const flag = node.mis ? `<p class="flag">${escapeHtml(node.why.join(" · "))}</p>` : "";
  const speech = node.voice
    ? `<p class="said">${escapeHtml(node.voice)}</p>` + (node.fr && node.fr !== node.voice ? `<p class="said"><b>Traduction.</b> ${escapeHtml(node.fr)}</p>` : "")
    : "";
  detailEl.className = "open";
  detailEl.innerHTML = `
    <h3>@${escapeHtml(node.user)}</h3>
    <p class="meta"><span>${escapeHtml(when(node.at))}</span><span>${nf.format(node.views)} vues</span><span>${nf.format(node.likes)} likes</span><span>${nf.format(node.comments)} commentaires</span><span>${nf.format(node.shares)} partages</span><a href="index.html#${node.id}">Ouvrir dans la frise</a> · <a href="https://www.tiktok.com/@${encodeURIComponent(node.user)}/video/${node.id}" target="_blank" rel="noopener">TikTok</a></p>
    ${flag}
    <p class="desc">${escapeHtml(node.desc || "(sans description)")}</p>
    ${speech}
    <ul class="rels">${rels || "<li>Aucun lien visible avec les filtres actuels.</li>"}</ul>`;
  renderList();
  renderMap();
  const spot = placed.get(id);
  if (spot) {
    wrapEl.scrollTo({ left: Math.max(0, spot.x - wrapEl.clientWidth / 2), top: Math.max(0, spot.y - wrapEl.clientHeight / 2), behavior: "smooth" });
  }
}

function focusComp(id) {
  activeComp = id;
  const comp = DATA.components.find((item) => item.id === id);
  renderList();
  renderMap();
  if (!comp) return;
  const spot = placed.get(comp.ids[0]);
  if (spot) wrapEl.scrollTo({ left: Math.max(0, spot.x - 40), top: Math.max(0, spot.y - 80), behavior: "smooth" });
}

listEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-comp]");
  if (button) focusComp(button.getAttribute("data-comp"));
});
pilesEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (button) showNode(button.getAttribute("data-id"));
});
mapEl.addEventListener("click", (event) => {
  const node = event.target.closest(".node");
  if (node) showNode(node.getAttribute("data-id"));
});
qEl.addEventListener("input", () => { renderList(); renderMap(); });
filterEls.forEach((el) => el.addEventListener("change", () => renderMap()));
window.addEventListener("resize", () => renderMap());
renderList();
renderMap();
</script>
</body>
</html>
"""


def main() -> None:
    payload = build()
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    OUT.write_text(TEMPLATE.replace("/*__DATA__*/", data), encoding="utf-8")
    meta = payload["meta"]
    print(
        f"wrote {OUT} circulations={meta['circulations']} piles={meta['piles']} "
        f"linked={meta['linked']} isolates={meta['isolates']} edges={meta['edges']}"
    )
    for comp in payload["components"][:12]:
        print(
            f"  {len(comp['accounts'])} comptes {len(comp['ids'])} vid {comp['kind']} {comp['title'][:70]}"
        )


if __name__ == "__main__":
    main()
