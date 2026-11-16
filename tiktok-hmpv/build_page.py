# -*- coding: utf-8 -*-
"""Page TikTok hMPV : frise, mésinformation susceptible, retranscriptions.

Les 545 vidéos viennent de l'export Research API
Tiktok/data/exports/hmpv_2025h1/videos.jsonl.

Le rouge n'est pas une expertise vidéo par vidéo. Il marque un texte
(description ou transcription) qui affirme au moins une chose démentie
en janvier 2025. Un texte qui cite ces affirmations pour les démentir
reste gris.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = Path(r"c:\Users\th8992be\Desktop\Tiktok\data\exports\hmpv_2025h1\videos.jsonl")
ASR = Path(r"c:\Users\th8992be\Desktop\Tiktok\data\exports\hmpv_2025h1\transcripts_asr.json")
FR = Path(r"c:\Users\th8992be\Desktop\Tiktok\data\exports\hmpv_2025h1\transcripts_fr.json")
OUT = ROOT / "index.html"

APOSTROPHES = str.maketrans({
    "\u2019": "'",
    "\u2018": "'",
    "\u02bc": "'",
    "\u00b4": "'",
    "`": "'",
    "\u2011": " ",
    "\u2013": " ",
    "\u2014": " ",
})

# Marqueur dans le texte entier : le propos cite la rumeur pour la démentir.
CORRECTIONS = (
    "2001",
    "deux-mille-un",
    "deux mille un",
    "deux mille et un",
    "decouvert en",
    "connu depuis",
    "connu des autorites",
    "on le connait depuis",
    "pas un nouveau",
    "n'est pas un nouveau",
    "n'est pas nouveau",
    "pas un virus nouveau",
    "not a new virus",
    "isn't a new",
    "is not a new",
    "n'est pas inconnu",
    "pas inconnu",
    "rien de nouveau",
    "n'a rien de nouveau",
    "existe bel et bien",
    "rumeurs circulent",
    "des rumeurs",
    "rumeurs sont",
    "sont fausses",
    "sont pour le moment fausses",
    "affirmation est fausse",
    "cette affirmation est fausse",
    "fake news",
    "n'a pas declare",
    "aucune annonce",
    "n'existe aucune",
    "n'ont pas declare",
    "pas declare l'etat",
    "aucune urgence",
    "pas d'etat d'urgence",
    "n'a pas declenche",
    "oms n'a pas",
    "rien communique",
    "n'a pour le moment rien",
    "pas de confinement",
    "n'y aura pas de confinement",
    "il n'y aura pas de confinement",
    "pas une menace",
    "on panique pour rien",
    "لم يعلن",
    "منذ عقدين",
    "معروف منذ",
    "ليس جديدا",
    "centaines de videos",
    "annoncant le retour",
    "did not declare",
    "no emergency",
    "not declared",
    "has not declared",
    "no es un virus nuevo",
    "no es nuevo",
)

HEDGES = (
    "aurait",
    "selon certains",
    "selon des",
    "des videos",
    "ces videos",
    "ces postes",
    "on dit que",
    "rumeur",
)

CLAIMS = (
    (
        "nouveau_virus",
        "présenté comme un virus nouveau",
        (
            "nouveau virus",
            "nouvel virus",
            "virus nouveau",
            "new virus",
            "nuevo virus",
            "virus nuevo",
            "brand new virus",
            "новый вирус",
            "новый virus",
            "taze wirus",
            "taze virus",
            "فيروس جديد",
            "الفيروس الجديد",
            "فايروس جديد",
        ),
    ),
    (
        "etat_urgence",
        "état d’urgence",
        (
            "etat d'urgence",
            "etat d urgence",
            "state of emergency",
            "estado de emergencia",
            "حالة الطوارئ",
            "حالة طوارئ",
        ),
    ),
    (
        "alerte_oms",
        "alerte maximale de l’OMS",
        (
            "urgence de sante publique",
            "plus haut niveau d'alerte",
            "plus haut niveau d alerte",
            "alerte mondiale",
            "alerta mundial",
            "highest level of alert",
            "public health emergency",
            "oms declenche",
            "oms declare",
            "who declares",
            "who declared",
        ),
    ),
    (
        "confinement",
        "confinement annoncé comme décidé",
        (
            "confinement provisoire",
            "confinement a partir",
            "confinement a compter",
            "retour des attestations",
            "fermeture des ecoles",
            "attestations de deplacement",
        ),
    ),
    (
        "plus_fort_covid",
        "présenté comme plus grave que le Covid",
        (
            "plus fort que le covid",
            "plus fort que corona",
            "plus fort que le corona",
            "plus dangereux que le covid",
            "plus mortel que le covid",
            "pire que le covid",
            "pire que la covid",
            "stronger than covid",
            "deadlier than covid",
            "worse than covid",
            "mas letal que el covid",
            "peor que el covid",
            "virus mortal",
            "أقوى من كورونا",
            "اقوى من كورونا",
            "اخطر من كورونا",
            "أخطر من كورونا",
            "اخطر فيروس",
            "أخطر فيروس",
            "اخطر_فيروس",
        ),
    ),
    (
        "effondrement",
        "effondrement hospitalier ou crématoriums",
        (
            "crematorium",
            "crematoire",
            "crematorio",
            "crematorios",
            "al borde del colapso",
            "borde del colapso",
            "on the brink of collapse",
            "hopitaux debordes",
            "hopitaux sont a nouveau debordes",
            "hospitals are overwhelmed",
            "hospitals overwhelmed",
            "poumon blanc",
            "white lung",
        ),
    ),
    (
        "dissimulation",
        "dissimulation ou scénario organisé",
        (
            "on nous cache",
            "ils nous cachent",
            "arme biologique",
            "bioweapon",
            "deep state",
            "plandemic",
            "les simpson avaient predit",
            "les simpsons avaient predit",
            "simpsons l'avaient",
            "conspiration de laboratoire",
            "sorti d'un laboratoire",
            "virus de laboratoire",
            "cree en laboratoire",
        ),
    ),
    (
        "sans_traitement",
        "pneumonie dangereuse et sans traitement",
        (
            "sans traitement",
        ),
    ),
)

ARABIC_NEW = re.compile(r"(?:فيروس|فايروس).{0,40}(?:الجديد|جديد)(?!ه)")
ARABIC_NEW_REV = re.compile(r"(?:الجديد|جديد)(?!ه).{0,24}(?:فيروس|فايروس)")


def plain(text: str) -> str:
    """Minuscules, apostrophes unifiées, accents latins retirés, symboles espacés."""
    text = (text or "").translate(APOSTROPHES).lower()
    out = []
    for ch in text:
        name = unicodedata.name(ch, "")
        if name.startswith("LATIN") and " WITH " in f" {name} ":
            out.append(unicodedata.normalize("NFD", ch)[0])
            continue
        cat = unicodedata.category(ch)
        if cat.startswith("L") or cat.startswith("N") or ch in " #'":
            out.append(ch)
        else:
            out.append(" ")
    return re.sub(r" {2,}", " ", "".join(out)).strip()


def hedged(text: str, phrase: str) -> bool:
    """True si chaque occurrence est précédée d'un conditionnel ou d'un « on dit que »."""
    start = 0
    found = False
    while True:
        i = text.find(phrase, start)
        if i < 0:
            break
        found = True
        window = text[max(0, i - 56) : i]
        if not any(hedge in window for hedge in HEDGES):
            return False
        start = i + len(phrase)
    return found


def classify(desc: str, voice: str) -> list[str]:
    text = plain(f"{desc or ''}\n{voice or ''}")
    if any(marker in text for marker in CORRECTIONS):
        return []
    labels: list[str] = []
    seen: set[str] = set()
    for code, label, phrases in CLAIMS:
        if code in seen:
            continue
        for phrase in phrases:
            needle = plain(phrase)
            if not needle or needle not in text or hedged(text, needle):
                continue
            if code == "sans_traitement" and not severe_near(text, needle):
                continue
            labels.append(label)
            seen.add(code)
            break
    scrubbed = text.replace("العام الجديد", " ")
    if "nouveau_virus" not in seen and (
        ARABIC_NEW.search(scrubbed) or ARABIC_NEW_REV.search(scrubbed)
    ):
        labels.append("présenté comme un virus nouveau")
    return labels


def severe_near(text: str, needle: str) -> bool:
    """« Sans traitement » ne compte que collé à une gravité affirmée."""
    start = 0
    while True:
        i = text.find(needle, start)
        if i < 0:
            return False
        window = text[max(0, i - 90) : i + len(needle) + 90]
        if any(word in window for word in ("dangereuse", "dangereux", "mortelle", "mortel")):
            return True
        start = i + len(needle)


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def load_asr() -> dict:
    return load_json(ASR)


def records() -> list[dict]:
    asr = load_asr()
    french = load_json(FR)
    rows = []
    for line in SRC.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        raw = json.loads(line)
        created = raw.get("create_time")
        at = ""
        if isinstance(created, (int, float)):
            at = datetime.fromtimestamp(created, tz=timezone.utc).isoformat()
        video_id = str(raw.get("id"))
        tiktok_voice = (raw.get("voice_to_text") or "").strip()
        extra = asr.get(video_id) or {}
        translated = french.get(video_id) or {}
        asr_text = (extra.get("text") or "").strip()
        if tiktok_voice:
            voice, vsrc = tiktok_voice, "tiktok"
        elif extra.get("status") == "ok" and asr_text:
            voice, vsrc = asr_text, "whisper"
        elif extra.get("status") == "empty":
            voice, vsrc = "", "empty"
        elif extra.get("status") == "noaudio":
            voice, vsrc = "", "noaudio"
        elif extra.get("status") == "error":
            voice, vsrc = "", "error"
        else:
            voice, vsrc = "", ""
        lang = (translated.get("lang") or extra.get("lang") or "").strip()
        fr = (translated.get("fr") or "").strip()
        if lang == "fr" and voice and not fr:
            fr = voice
        tags = raw.get("hashtag_names") or []
        if not isinstance(tags, list):
            tags = []
        heard = voice if not fr or fr == voice else f"{voice}\n{fr}"
        why = classify(raw.get("video_description") or "", heard)
        rows.append(
            {
                "id": str(raw.get("id")),
                "user": raw.get("username") or "",
                "at": at,
                "desc": raw.get("video_description") or "",
                "views": int(raw.get("view_count") or 0),
                "likes": int(raw.get("like_count") or 0),
                "comments": int(raw.get("comment_count") or 0),
                "shares": int(raw.get("share_count") or 0),
                "tags": [str(tag) for tag in tags],
                "dur": int(raw.get("video_duration") or 0),
                "voice": voice,
                "vsrc": vsrc,
                "lang": lang,
                "fr": fr,
                "mis": bool(why),
                "why": why,
            }
        )
    rows.sort(key=lambda row: row["at"])
    return rows


def selftest() -> None:
    assert classify("le nouveau virus en Chine provoque l'état d'urgence", "") 
    assert "état d’urgence" in classify("provoque l’état d’urgence", "")
    assert classify("connu depuis deux-mille-un, ce n'est pas un nouveau virus", "") == []
    assert classify("Spoiler : ce n’est pas une menace réelle. On panique pour rien.", "nouveau virus") == []
    assert classify("les rumeurs sont pour le moment fausses", "la chine aurait déclaré l'état d'urgence") == []
    assert classify("Sauf que cette affirmation est fausse.", "les postes affirment qu'il s'agit d'un nouveau virus") == []
    assert "présenté comme un virus nouveau" in classify("فيروس 🦠 صيني 🇨🇳جديد", "")
    assert "présenté comme un virus nouveau" in classify("Новый Virus из Китая", "")
    assert "présenté comme un virus nouveau" in classify("ýene bir täze wirus döredi", "")
    assert "pneumonie dangereuse et sans traitement" in classify(
        "une pneumonie dangereuse ressemblant à la grippe et sans traitement", ""
    )
    assert classify("morts sans traitement. la mortalite mondiale est elevee", "") == []
    assert classify("il n’existe aucune annonce officielle de la mise en place d’un état d’urgence", "") == []
    assert "confinement annoncé comme décidé" in classify(
        "confinement provisoire décrété. Abonnez-vous pour suivre la désinformation en temps réel",
        "",
    )
    assert classify("تصميمات العام الجديد #hmpv #فيروس", "") == []
    assert classify("traitement de soutien, pas de remède spécifique", "") == []
    print("selftest ok")


TEMPLATE = r"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>hMPV · TikTok FR</title>
<style>
  :root {
    --bg: #f3f5f9;
    --ink: #1c2434;
    --muted: #7c8696;
    --line: #d5dce8;
    --card: #ffffff;
    --accent: #3d6fbe;
    --accent-bg: #f6f9ff;
    --mis: #d23b4a;
    --mis-bg: #fff1f2;
    --mis-ink: #8d2433;
    --other: #b7c2d1;
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
  button, input, select { font: inherit; color: inherit; }
  a { color: var(--accent); }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    align-items: end;
    justify-content: space-between;
    padding: 14px 18px 12px;
    background: rgba(243, 245, 249, 0.96);
    border-bottom: 1px solid #e6ebf3;
  }
  h1 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: -0.01em; }
  .sub { margin: 3px 0 0; color: var(--muted); font-size: 13px; }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  input, select {
    height: 36px;
    padding: 0 10px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  input { width: min(320px, 70vw); }
  #misonly, #dayclear {
    height: 36px;
    padding: 0 12px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 6px;
    cursor: pointer;
  }
  #misonly[aria-pressed="true"] {
    background: var(--mis-bg);
    border-color: #e7b4ba;
    color: var(--mis-ink);
  }
  #frise {
    background: var(--card);
    border-bottom: 1px solid var(--line);
    padding: 8px 18px 8px;
  }
  .frise-top {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    align-items: center;
    justify-content: space-between;
  }
  .frise-top p { margin: 0; font-size: 13px; }
  .legend { display: flex; flex-wrap: wrap; gap: 12px; color: var(--muted); font-size: 12px; }
  .swatch {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 5px;
    vertical-align: 0;
  }
  .swatch.mis { background: var(--mis); }
  .swatch.other { background: var(--other); }
  .frise-scroll { overflow-x: auto; overflow-y: hidden; margin-top: 4px; }
  #frise-plot { display: block; height: 168px; }
  #frise-plot .dot, #frise-plot .slot { cursor: pointer; }
  .frise-note { margin: 2px 0 0; color: var(--muted); font-size: 12px; line-height: 1.35; }
  #app {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(280px, 400px) minmax(0, 1fr);
  }
  aside, main { min-height: 0; }
  aside {
    overflow: auto;
    border-right: 1px solid var(--line);
    background: var(--card);
  }
  #count {
    position: sticky;
    top: 0;
    z-index: 1;
    margin: 0;
    padding: 8px 14px;
    background: var(--card);
    border-bottom: 1px solid #e6ebf3;
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: block;
    width: 100%;
    padding: 10px 14px 12px;
    text-align: left;
    background: transparent;
    border: 0;
    border-bottom: 1px solid #eef2f7;
    cursor: pointer;
  }
  .row.mis { box-shadow: inset 3px 0 0 var(--mis); }
  .row:hover { background: #f7f9fc; }
  .row.active { background: var(--accent-bg); }
  .row.mis.active { background: var(--mis-bg); }
  .row-top {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .row-user { color: var(--ink); font-weight: 650; }
  .row-desc {
    margin: 4px 0 0;
    font-size: 14px;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  main { overflow: auto; padding: 16px 20px 40px; }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .bar button {
    height: 36px;
    padding: 0 12px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 6px;
    cursor: pointer;
  }
  .bar button:disabled { opacity: 0.35; cursor: default; }
  #who { flex: 1; min-width: 0; font-size: 15px; }
  #who span { color: var(--muted); font-size: 13px; }
  .stage {
    display: grid;
    grid-template-columns: 325px minmax(0, 1fr);
    gap: 22px;
    align-items: start;
  }
  .frame {
    width: 325px;
    height: 575px;
    background: #0e1116;
    border-radius: 8px;
    overflow: hidden;
  }
  iframe { width: 100%; height: 100%; border: 0; background: #0e1116; }
  #meta h2 { margin: 0 0 8px; font-size: 16px; font-weight: 650; }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin: 0 0 12px;
    color: var(--muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .flag {
    margin: 0 0 12px;
    padding: 8px 10px;
    background: var(--mis-bg);
    color: var(--mis-ink);
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.4;
  }
  .desc { margin: 0 0 12px; white-space: pre-wrap; line-height: 1.45; font-size: 15px; }
  .tags { margin: 0 0 14px; color: #5c6778; font-size: 13px; line-height: 1.4; }
  .transcript h3 {
    margin: 16px 0 4px;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .tsrc { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.4; }
  .voice { margin: 8px 0 0; white-space: pre-wrap; color: #3c4656; font-size: 14px; line-height: 1.45; }
  .hint { margin: 14px 0 0; color: var(--muted); font-size: 12px; line-height: 1.4; }
  @media (max-width: 860px) {
    #app { grid-template-columns: 1fr; }
    aside { max-height: 38vh; border-right: 0; border-bottom: 1px solid var(--line); }
    .stage { grid-template-columns: 1fr; }
    .frame { width: min(325px, 100%); height: 70vw; max-height: 575px; }
  }
</style>
</head>
<body>
<header>
  <div>
    <h1>hMPV · TikTok FR</h1>
    <p class="sub">545 vidéos publiques · comptes région FR · 3 janv. – 30 mai 2025 · <a href="reseau.html">Cartographie des reprises</a></p>
  </div>
  <div class="tools">
    <input id="q" type="search" placeholder="Description, compte, hashtag, transcription, traduction" aria-label="Filtrer">
    <select id="month" aria-label="Mois"></select>
    <select id="sort" aria-label="Tri">
      <option value="date">Date</option>
      <option value="views">Vues</option>
      <option value="likes">Likes</option>
    </select>
    <button id="misonly" type="button" aria-pressed="false">Mésinformation seulement</button>
  </div>
</header>
<section id="frise" aria-label="Frise chronologique">
  <div class="frise-top">
    <p id="frise-title"></p>
    <div class="legend">
      <span><i class="swatch mis"></i>Mésinformation susceptible</span>
      <span><i class="swatch other"></i>Autre publication</span>
      <button id="dayclear" type="button" hidden>Tout voir</button>
    </div>
  </div>
  <div class="frise-scroll">
    <svg id="frise-plot" role="img"></svg>
  </div>
  <p class="frise-note">Chaque point est une publication, dans l’ordre du temps. Sa taille suit les engagements (likes + commentaires + partages), sur une échelle logarithmique. Le rouge isole un texte qui affirme au moins une chose démentie en janvier 2025 : virus nouveau, état d’urgence, alerte maximale de l’OMS, confinement décidé, gravité supérieure au Covid, effondrement hospitalier, ou dissimulation. Un texte qui cite ces affirmations pour les démentir reste gris.</p>
</section>
<div id="app">
  <aside>
    <p id="count"></p>
    <div id="list"></div>
  </aside>
  <main>
    <div class="bar">
      <button id="prev" type="button">Précédente</button>
      <div id="who"></div>
      <button id="next" type="button">Suivante</button>
    </div>
    <div class="stage">
      <div class="frame">
        <iframe id="player" title="Lecture TikTok" allow="fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
      <article id="meta"></article>
    </div>
  </main>
</div>
<script>
const DATA = /*__DATA__*/;

const nf = new Intl.NumberFormat("fr-FR");
const df = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
});
const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "short", timeZone: "Europe/Paris"
});
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });
const monthShort = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "Europe/Paris" });

const qEl = document.getElementById("q");
const monthEl = document.getElementById("month");
const sortEl = document.getElementById("sort");
const misBtn = document.getElementById("misonly");
const dayClear = document.getElementById("dayclear");
const listEl = document.getElementById("list");
const countEl = document.getElementById("count");
const whoEl = document.getElementById("who");
const metaEl = document.getElementById("meta");
const player = document.getElementById("player");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const plot = document.getElementById("frise-plot");
const friseTitle = document.getElementById("frise-title");

const months = [...new Set(DATA.map((v) => v.at.slice(0, 7)))].sort();
monthEl.innerHTML = '<option value="">Tous les mois</option>' + months.map((m) => {
  const n = DATA.filter((v) => v.at.slice(0, 7) === m).length;
  const label = monthFmt.format(new Date(m + "-15T12:00:00Z"));
  return `<option value="${m}">${label} (${n})</option>`;
}).join("");

let current = 0;
let shown = [];
let dayFilter = "";
let misOnly = false;
const misCount = DATA.filter((v) => v.mis).length;

function when(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : df.format(d);
}

function urlOf(v) {
  return "https://www.tiktok.com/@" + encodeURIComponent(v.user) + "/video/" + v.id;
}

function visible() {
  const q = qEl.value.trim().toLowerCase();
  const month = monthEl.value;
  const rows = DATA.filter((v) => {
    if (misOnly && !v.mis) return false;
    if (dayFilter && dayKey(v.at) !== dayFilter) return false;
    if (month && !v.at.startsWith(month)) return false;
    if (!q) return true;
    const blob = (v.user + "\n" + v.desc + "\n" + v.tags.join(" ") + "\n" + v.voice + "\n" + (v.fr || "")).toLowerCase();
    return blob.includes(q);
  });
  const key = sortEl.value;
  rows.sort((a, b) => {
    if (key === "views") return b.views - a.views || a.at.localeCompare(b.at);
    if (key === "likes") return b.likes - a.likes || a.at.localeCompare(b.at);
    return a.at.localeCompare(b.at);
  });
  return rows;
}

function renderList() {
  shown = visible();
  const misHere = shown.filter((v) => v.mis).length;
  countEl.textContent = shown.length + " / " + DATA.length + " · " + misHere + " en rouge";
  listEl.innerHTML = shown.map((v, i) => `
    <button type="button" class="row${v.mis ? " mis" : ""}${i === current ? " active" : ""}" data-i="${i}">
      <div class="row-top">
        <span class="row-user">@${escapeHtml(v.user)}</span>
        <span>${nf.format(v.views)} vues</span>
      </div>
      <div class="row-top"><span>${when(v.at)}</span></div>
      <p class="row-desc">${escapeHtml(v.desc || "(sans description)")}</p>
    </button>`).join("");
  const active = listEl.querySelector(".row.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

const LANG = {
  ar: "arabe", de: "allemand", en: "anglais", es: "espagnol", fr: "français",
  hi: "hindi", id: "indonésien", it: "italien", ja: "japonais", ko: "coréen",
  nl: "néerlandais", pl: "polonais", pt: "portugais", ro: "roumain", ru: "russe",
  tr: "turc", uk: "ukrainien", vi: "vietnamien", zh: "chinois", fa: "persan",
  ur: "ourdou", bn: "bengali", ta: "tamoul", te: "télougou", ml: "malayalam",
  mr: "marathi", gu: "gujarati", pa: "pendjabi", ne: "népalais", ps: "pachto",
  he: "hébreu", el: "grec", th: "thaï", sv: "suédois", da: "danois", fi: "finnois",
  cs: "tchèque", hu: "hongrois", bg: "bulgare", hr: "croate", sk: "slovaque",
  sl: "slovène", lt: "lituanien", lv: "letton", et: "estonien", sq: "albanais",
  mk: "macédonien", ka: "géorgien", hy: "arménien", az: "azéri", kk: "kazakh",
  ms: "malais", sw: "swahili", am: "amharique", my: "birman", km: "khmer",
  lo: "lao", si: "cingalais", tl: "tagalog", ca: "catalan", br: "breton"
};

function langLabel(code) {
  if (!code) return "non identifiée";
  return LANG[code] || code;
}

function transcriptBlock(v) {
  if (v.voice) {
    const source = v.vsrc === "tiktok"
      ? "Fournie par TikTok, champ voice_to_text."
      : "Calculée avec Whisper (modèle small), quelle que soit la langue parlée.";
    const french = (v.lang === "fr") || (v.fr && v.fr === v.voice);
    if (french) {
      return `<section class="transcript"><h3>Retranscription</h3><p class="tsrc">${source} Texte en français.</p><p class="voice">${escapeHtml(v.voice)}</p></section>`;
    }
    const translated = v.fr
      ? `<h3>Traduction en français</h3><p class="voice">${escapeHtml(v.fr)}</p>`
      : `<p class="tsrc">La traduction en français n’a pas pu être produite pour cette langue.</p>`;
    return `<section class="transcript"><h3>Retranscription</h3><p class="tsrc">${source} Langue d’origine : ${escapeHtml(langLabel(v.lang))}.</p><p class="voice">${escapeHtml(v.voice)}</p>${translated}</section>`;
  }
  if (v.vsrc === "empty") {
    return `<section class="transcript"><h3>Retranscription</h3><p class="tsrc">Piste audio lue, dans toutes les langues : aucune parole détectée.</p></section>`;
  }
  if (v.vsrc === "noaudio") {
    return `<section class="transcript"><h3>Retranscription</h3><p class="tsrc">Publication image ou carrousel : aucune piste audio récupérable.</p></section>`;
  }
  if (v.vsrc === "error") {
    return `<section class="transcript"><h3>Retranscription</h3><p class="tsrc">TikTok a refusé la piste audio (vidéo restreinte, retirée, ou limite d’accès). La parole n’a pas pu être calculée. Le texte de la description reste affiché.</p></section>`;
  }
  if (!v.dur) {
    return `<section class="transcript"><h3>Retranscription</h3><p class="tsrc">Publication sans durée vidéo enregistrée. La piste audio est encore en cours de lecture.</p></section>`;
  }
  return `<section class="transcript"><h3>Retranscription</h3><p class="tsrc">La piste audio n’a pas encore été transcrite.</p></section>`;
}

function show(index, scroll) {
  if (!shown.length) {
    current = 0;
    whoEl.textContent = "Aucun résultat";
    metaEl.innerHTML = "";
    player.removeAttribute("src");
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    renderFrise();
    return;
  }
  current = Math.max(0, Math.min(shown.length - 1, index));
  const v = shown[current];
  prevBtn.disabled = current === 0;
  nextBtn.disabled = current === shown.length - 1;
  whoEl.innerHTML = "@" + escapeHtml(v.user) + " <span>" + when(v.at) + " · " + (current + 1) + " / " + shown.length + "</span>";
  const tags = v.tags.length ? `<p class="tags">${v.tags.map((t) => "#" + escapeHtml(t)).join(" ")}</p>` : "";
  const flag = v.mis
    ? `<p class="flag">Susceptible d’être de la mésinformation — ${escapeHtml(v.why.join(" · "))}</p>`
    : "";
  const dur = v.dur ? `${v.dur} s` : "sans durée";
  metaEl.innerHTML = `
    <h2>@${escapeHtml(v.user)}</h2>
    ${flag}
    <p class="stats">
      <span>${nf.format(v.views)} vues</span>
      <span>${nf.format(v.likes)} likes</span>
      <span>${nf.format(v.comments)} commentaires</span>
      <span>${nf.format(v.shares)} partages</span>
      <span>${dur}</span>
    </p>
    <p class="desc">${escapeHtml(v.desc || "")}</p>
    ${tags}
    <p><a href="${urlOf(v)}" target="_blank" rel="noopener">Ouvrir sur TikTok</a></p>
    ${transcriptBlock(v)}
    <p class="hint">Le lecteur charge la vidéo publique chez TikTok. Une vidéo retirée, privée ou restreinte reste visible ici par son texte, et le lien peut ne plus s’ouvrir.</p>`;
  const src = "https://www.tiktok.com/embed/v2/" + v.id;
  if (player.getAttribute("src") !== src) player.src = src;
  history.replaceState(null, "", "#" + v.id);
  listEl.querySelectorAll(".row").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.i) === current);
  });
  if (scroll) {
    const active = listEl.querySelector(".row.active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }
  renderFrise();
}

function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d);
  return parts;
}

function engagement(v) {
  return (v.likes || 0) + (v.comments || 0) + (v.shares || 0);
}

const engMax = Math.max(1, ...DATA.map(engagement));

function dotRadius(v) {
  const t = Math.log1p(engagement(v)) / Math.log1p(engMax);
  return 2.1 + t * 5.2;
}

function renderFrise() {
  const by = new Map();
  for (const v of DATA) {
    const day = dayKey(v.at);
    if (!by.has(day)) by.set(day, []);
    by.get(day).push(v);
  }
  const days = [...by.keys()].sort();
  const lanes = 6;
  const lanePitch = 18;
  const colPitch = 16;
  const slots = [];
  let x = 16;
  let prev = null;
  for (const day of days) {
    if (prev) {
      const gap = Math.round((Date.parse(day + "T12:00:00Z") - Date.parse(prev + "T12:00:00Z")) / 86400000);
      if (gap > 1) x += Math.min(gap, 16) * 7;
    }
    const items = by.get(day).slice().sort((a, b) => a.at.localeCompare(b.at));
    const cols = Math.max(1, Math.ceil(items.length / lanes));
    const width = Math.max(colPitch, cols * colPitch);
    slots.push({ day, x, width, items });
    x += width + 8;
    prev = day;
  }
  const total = Math.max(x + 16, plot.parentElement.clientWidth || 0);
  const height = 168;
  const shownIds = new Set(shown.map((v) => v.id));
  const active = shown[current] && shown[current].id;
  const parts = [];
  let lastMonth = "";
  let labelX = -1000;
  for (const slot of slots) {
    const month = slot.day.slice(0, 7);
    const showMonth = month !== lastMonth;
    lastMonth = month;
    const hot = dayFilter === slot.day;
    parts.push(`<rect class="slot" data-day="${slot.day}" x="${slot.x - 3}" y="10" width="${slot.width + 6}" height="128" fill="${hot ? "#fff1f2" : "transparent"}"></rect>`);
    if (showMonth || slot.x - labelX >= 46) {
      const dayNum = String(Number(slot.day.slice(8)));
      const caption = showMonth
        ? dayNum + " " + monthShort.format(new Date(slot.day + "T12:00:00Z"))
        : dayNum;
      parts.push(`<text x="${slot.x}" y="156" fill="#7c8696" font-size="10" font-family="Aptos, Segoe UI, sans-serif">${escapeHtml(caption)}</text>`);
      labelX = slot.x;
    }
    slot.items.forEach((v, i) => {
      const col = Math.floor(i / lanes);
      const lane = i % lanes;
      const cx = slot.x + colPitch / 2 + col * colPitch;
      const cy = 20 + lane * lanePitch;
      const dim = shownIds.size && !shownIds.has(v.id) ? 0.22 : 1;
      const fill = v.mis ? "#d23b4a" : "#b7c2d1";
      const stroke = v.id === active ? ' stroke="#1c2434" stroke-width="1.4"' : "";
      const r = dotRadius(v).toFixed(2);
      const eng = engagement(v);
      parts.push(`<circle class="dot" data-id="${v.id}" cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${dim}"${stroke}><title>@${escapeHtml(v.user)} · ${escapeHtml(when(v.at))} · ${nf.format(eng)} engagements${v.mis ? " · mésinformation" : ""}</title></circle>`);
    });
  }
  plot.setAttribute("viewBox", `0 0 ${total} ${height}`);
  plot.setAttribute("width", String(total));
  plot.setAttribute("height", String(height));
  plot.innerHTML = parts.join("");
  const dayLabel = dayFilter
    ? " · " + dayFmt.format(new Date(dayFilter + "T12:00:00Z"))
    : "";
  friseTitle.textContent = misCount + " publications en rouge sur " + DATA.length + dayLabel;
  dayClear.hidden = !dayFilter;
}

function refresh(keepId) {
  const id = keepId || (shown[current] && shown[current].id);
  renderList();
  let index = shown.findIndex((v) => v.id === id);
  if (index < 0) index = 0;
  show(index, true);
}

function openId(id) {
  const video = DATA.find((v) => v.id === id);
  if (!video) return;
  if (misOnly && !video.mis) {
    misOnly = false;
    misBtn.setAttribute("aria-pressed", "false");
  }
  if (dayFilter && dayKey(video.at) !== dayFilter) {
    dayFilter = "";
  }
  if (monthEl.value && !video.at.startsWith(monthEl.value)) monthEl.value = "";
  refresh(id);
}

listEl.addEventListener("click", (event) => {
  const row = event.target.closest(".row");
  if (!row) return;
  show(Number(row.dataset.i), false);
});
plot.addEventListener("click", (event) => {
  const dot = event.target.closest(".dot");
  if (dot) {
    openId(dot.getAttribute("data-id"));
    return;
  }
  const slot = event.target.closest(".slot");
  if (!slot) return;
  const day = slot.getAttribute("data-day");
  dayFilter = dayFilter === day ? "" : day;
  refresh();
});
prevBtn.addEventListener("click", () => show(current - 1, true));
nextBtn.addEventListener("click", () => show(current + 1, true));
qEl.addEventListener("input", () => refresh());
monthEl.addEventListener("change", () => { dayFilter = ""; refresh(); });
sortEl.addEventListener("change", () => refresh());
misBtn.addEventListener("click", () => {
  misOnly = !misOnly;
  misBtn.setAttribute("aria-pressed", misOnly ? "true" : "false");
  refresh();
});
dayClear.addEventListener("click", () => { dayFilter = ""; refresh(); });
document.addEventListener("keydown", (event) => {
  if (event.target === qEl) return;
  if (event.key === "ArrowLeft") show(current - 1, true);
  if (event.key === "ArrowRight") show(current + 1, true);
});

const startId = location.hash.replace("#", "");
renderList();
const start = shown.findIndex((v) => v.id === startId);
show(start >= 0 ? start : 0, true);
</script>
</body>
</html>
"""


def write_html(rows: list[dict]) -> None:
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    OUT.write_text(TEMPLATE.replace("/*__DATA__*/", payload), encoding="utf-8")


def review(rows: list[dict]) -> None:
    flagged = [row for row in rows if row["mis"]]
    print(f"n={len(rows)} flagged={len(flagged)}")
    print(Counter(label for row in flagged for label in row["why"]))
    flagged.sort(key=lambda row: -row["views"])
    path = ROOT / "_misinfo_review.txt"
    lines = []
    for row in flagged:
        desc = (row["desc"] or "").replace("\n", " ")[:180]
        lines.append(f"{row['views']} @{row['user']} [{ ' · '.join(row['why']) }] {desc}")
    path.write_text("\n".join(lines), encoding="utf-8")
    print("review", path)


def main() -> None:
    if "--selftest" in sys.argv:
        selftest()
        return
    rows = records()
    if "--review" in sys.argv:
        review(rows)
        return
    write_html(rows)
    flagged = sum(1 for row in rows if row["mis"])
    voices = Counter(row["vsrc"] or "pending" for row in rows)
    print(f"wrote {OUT} videos={len(rows)} misinfo={flagged} voices={dict(voices)}")


if __name__ == "__main__":
    main()
