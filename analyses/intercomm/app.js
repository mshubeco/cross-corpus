/* Analyses intercommunautaires — un corpus (données JSON locales). */
(function () {
  const CORPUS = window.INTERCOMM_CORPUS;
  const CORPORA = [
    { id: "ebola", label: "Ebola" },
    { id: "hantavirus", label: "Hantavirus" },
    { id: "mpox", label: "Mpox" },
    { id: "macron_nucleaire", label: "Macron nucléaire" },
  ];

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
  const fmt = (n) => (n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("fr-FR"));
  const xUrl = (h) => {
    const raw = String(h || "").replace(/^@/, "");
    return raw ? `https://x.com/${encodeURIComponent(raw)}` : "#";
  };

  function plotlyLayout(extra) {
    return Object.assign({
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#e8eaed", size: 11, family: "Segoe UI, system-ui, sans-serif" },
      margin: { t: 28, b: 40, l: 52, r: 12 },
    }, extra || {});
  }

  function plotDonut(el, block, title) {
    if (!el || !block?.slices?.length) return;
    Plotly.newPlot(el, [{
      type: "pie", hole: 0.58,
      labels: block.slices.map((s) => s.hub ? `@${s.hub}` : s.label),
      values: block.slices.map((s) => s.value),
      marker: { colors: block.slices.map((s) => s.color) },
      textinfo: "percent",
      hovertemplate: "%{label}<br>%{value:,} (%{percent})<extra></extra>",
    }], plotlyLayout({
      title: { text: title, font: { size: 12, color: "#9aa3b5" } },
      margin: { t: 36, b: 8, l: 8, r: 8 },
      showlegend: true,
      legend: { orientation: "h", y: -0.06, font: { size: 10 } },
      height: 310,
    }), { responsive: true, displayModeBar: false });
  }

  function plotVolume(el, vol) {
    if (!el || !vol?.dates?.length) return;
    Plotly.newPlot(el, [{
      x: vol.dates, y: vol.counts, type: "bar",
      marker: { color: "#4d8af0" },
      hovertemplate: "%{x}<br>%{y:,} tweets<extra></extra>",
    }], plotlyLayout({ height: 280, yaxis: { gridcolor: "#2a3142", title: "tweets" }, xaxis: { gridcolor: "#2a3142" } }),
    { responsive: true, displayModeBar: false });
  }

  function plotActivity(el, daily) {
    if (!el || !daily?.series?.length) return;
    const traces = daily.series.map((s) => ({
      x: daily.dates, y: s.counts,
      name: s.hub ? `@${s.hub}` : s.label,
      type: "scatter", mode: "lines",
      line: { color: s.color, width: s.communityId === -1 ? 1.2 : 2.2 },
      stackgroup: "one",
    }));
    Plotly.newPlot(el, traces, plotlyLayout({
      height: 360, legend: { orientation: "h", y: 1.14 },
      xaxis: { gridcolor: "#2a3142" },
      yaxis: { gridcolor: "#2a3142", title: "publications" },
    }), { responsive: true, displayModeBar: false });
  }

  function plotEngagement(el, ph) {
    if (!el) return;
    const byId = (ph.inStrengthByType || {}).byId || {};
    const top5 = ((ph.inStrengthByType || {}).top5 || []).map(String);
    const types = (ph.inStrengthByType || {}).types || ["rt", "reply", "quote", "mention"];
    const colors = { rt: "#4d8af0", reply: "#e08a3a", quote: "#de81ff", mention: "#00bd94" };
    const hubs = Object.fromEntries((ph.nodes || []).map((n) => [String(n.communityId ?? n.id), n.hub]));
    const y = top5.map((id) => hubs[id] ? `@${hubs[id]}` : `C${id}`);
    const traces = types.map((t) => ({
      type: "bar", orientation: "h", name: t,
      y, x: top5.map((id) => (byId[id] || {})[t] || 0),
      marker: { color: colors[t] || "#9aa3b5" },
    }));
    Plotly.newPlot(el, traces, plotlyLayout({
      barmode: "stack", height: 360, legend: { orientation: "h", y: 1.14 },
      margin: { t: 28, b: 40, l: 110, r: 12 },
      xaxis: { gridcolor: "#2a3142" }, yaxis: { autorange: "reversed" },
    }), { responsive: true, displayModeBar: false });
  }

  function plotLikes(el, ph) {
    if (!el) return;
    const likes = ph.likesByCommunity || {};
    const top5 = (likes.top5 || []).map(String);
    const byId = likes.byId || {};
    Plotly.newPlot(el, [{
      type: "bar", orientation: "h",
      y: top5.map((id) => byId[id]?.hub ? `@${byId[id].hub}` : `C${id}`),
      x: top5.map((id) => byId[id]?.likes || 0),
      marker: { color: top5.map((id) => byId[id]?.color || "#4d8af0") },
      customdata: top5.map((id) => byId[id]?.pubs || 0),
      hovertemplate: "%{y}<br>%{x:,} likes · %{customdata} pubs hors RT<extra></extra>",
    }], plotlyLayout({
      height: 360, margin: { t: 28, b: 40, l: 110, r: 12 },
      xaxis: { gridcolor: "#2a3142" }, yaxis: { autorange: "reversed" },
    }), { responsive: true, displayModeBar: false });
  }

  function plotConcentration(el, ph) {
    if (!el) return;
    const comms = (ph.receiverConcentration || {}).communities || {};
    const ids = Object.keys(comms);
    const ks = ["top5_pct", "top20_pct", "top50_pct"];
    const names = ["Top 5", "Top 20", "Top 50"];
    const traces = ks.map((k, i) => ({
      type: "bar", name: names[i],
      x: ids.map((id) => comms[id].hub ? `@${comms[id].hub}` : `C${id}`),
      y: ids.map((id) => comms[id][k] || 0),
    }));
    Plotly.newPlot(el, traces, plotlyLayout({
      barmode: "group", height: 340, legend: { orientation: "h", y: 1.14 },
      yaxis: { title: "% in-strength", gridcolor: "#2a3142", range: [0, 100] },
      xaxis: { tickangle: -22 },
    }), { responsive: true, displayModeBar: false });
  }

  function cidOf(n) { return Number(n.communityId ?? n.id); }

  function buildSankeyLayout(ph) {
    const links = ((ph.sankey || {}).links || []).map((l) => ({
      ...l,
      from: Number(l.from),
      to: Number(l.to),
      weight: l.weight || 0,
      internal: l.internal != null ? l.internal : Number(l.from) === Number(l.to),
    }));
    const nodes = ph.nodes || [];
    const order = [...nodes].sort((a, b) => {
      const inA = links.filter((l) => l.to === cidOf(a)).reduce((s, l) => s + l.weight, 0);
      const inB = links.filter((l) => l.to === cidOf(b)).reduce((s, l) => s + l.weight, 0);
      return inB - inA;
    });
    const outTot = {}, inTot = {};
    nodes.forEach((n) => { outTot[cidOf(n)] = 0; inTot[cidOf(n)] = 0; });
    links.forEach((l) => { outTot[l.from] = (outTot[l.from] || 0) + l.weight; inTot[l.to] = (inTot[l.to] || 0) + l.weight; });
    const flowSum = links.reduce((s, l) => s + l.weight, 0) || 1;
    const innerH = 340, gap = 10, n = Math.max(order.length, 1);
    const avail = innerH - gap * (n - 1);
    const leftPos = {}, rightPos = {};
    let y = 28;
    for (const c of order) {
      const h = Math.max(10, (outTot[cidOf(c)] / flowSum) * avail);
      leftPos[cidOf(c)] = { y0: y, y1: y + h, outOff: 0 };
      y += h + gap;
    }
    y = 28;
    for (const c of order) {
      const h = Math.max(10, (inTot[cidOf(c)] / flowSum) * avail);
      rightPos[cidOf(c)] = { y0: y, y1: y + h, inOff: 0 };
      y += h + gap;
    }
    const ribbons = [];
    const bySrc = {};
    links.forEach((l) => { (bySrc[l.from] = bySrc[l.from] || []).push(l); });
    for (const c of order) {
      const src = leftPos[cidOf(c)];
      const nodeH = src.y1 - src.y0;
      const srcTot = outTot[cidOf(c)] || 1;
      for (const lk of (bySrc[cidOf(c)] || [])) {
        const tgt = rightPos[lk.to];
        if (!tgt) continue;
        const tgtH = tgt.y1 - tgt.y0;
        const tgtTot = inTot[lk.to] || 1;
        const hSrc = nodeH * (lk.weight / srcTot);
        const hTgt = tgtH * (lk.weight / tgtTot);
        const sy0 = src.y0 + src.outOff; src.outOff += hSrc;
        const ty0 = tgt.y0 + tgt.inOff; tgt.inOff += hTgt;
        ribbons.push({ lk, sy0, sy1: sy0 + hSrc, ty0, ty1: ty0 + hTgt, color: c.color });
      }
    }
    return { order, leftPos, rightPos, ribbons, height: y + 8 };
  }

  function renderSankey(svg, ph) {
    if (!svg) return;
    const s = ph.sankey || {};
    const { order, leftPos, rightPos, ribbons, height } = buildSankeyLayout(ph);
    const W = 860, H = Math.max(400, height + 12);
    const LX = 168, RX = 678, LW = 16;
    let html = `<text x="${LX + LW / 2}" y="16" text-anchor="middle" class="sankey-label">Source</text>
      <text x="${RX + LW / 2}" y="16" text-anchor="middle" class="sankey-label">Cible</text>`;
    ribbons.forEach((rb) => {
      const x0 = LX + LW, x1 = RX;
      const d = `M ${x0} ${rb.sy0} C ${x0 + 130} ${rb.sy0}, ${x1 - 130} ${rb.ty0}, ${x1} ${rb.ty0}
                 L ${x1} ${rb.ty1} C ${x1 - 130} ${rb.ty1}, ${x0 + 130} ${rb.sy1}, ${x0} ${rb.sy1} Z`;
      html += `<path d="${d}" fill="${esc(rb.color)}" fill-opacity="${rb.lk.internal ? 0.28 : 0.55}">
        <title>@${esc(order.find((n) => cidOf(n) === rb.lk.from)?.hub || rb.lk.from)} → @${esc(order.find((n) => cidOf(n) === rb.lk.to)?.hub || rb.lk.to)} · ${fmt(rb.lk.weight)}${rb.lk.internal ? " (interne)" : ""}</title>
      </path>`;
    });
    order.forEach((c) => {
      const id = cidOf(c);
      const lp = leftPos[id], rp = rightPos[id];
      html += `<rect x="${LX}" y="${lp.y0}" width="${LW}" height="${Math.max(1, lp.y1 - lp.y0)}" fill="${esc(c.color)}" rx="2"/>
        <rect x="${RX}" y="${rp.y0}" width="${LW}" height="${Math.max(1, rp.y1 - rp.y0)}" fill="${esc(c.color)}" rx="2"/>
        <text x="${LX - 8}" y="${(lp.y0 + lp.y1) / 2 + 4}" text-anchor="end" class="sankey-node-label" fill="${esc(c.color)}">${esc(c.label || ("C" + id))} · @${esc(c.hub || "")}</text>
        <text x="${RX + LW + 8}" y="${(rp.y0 + rp.y1) / 2 + 4}" class="sankey-node-label" fill="${esc(c.color)}">${esc(c.label || ("C" + id))} · @${esc(c.hub || "")}</text>`;
    });
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = html;
    const meta = document.getElementById("sankey-meta");
    if (meta) {
      const nCross = (s.links || []).filter((l) => !l.internal && l.from !== l.to).length;
      meta.textContent = `${fmt(s.total)} interactions · ${s.internalPct ?? "—"} % internes · ${nCross} flux croisés · gauche = émetteur, droite = récepteur`;
    }
  }

  function treemapLayout(slices, x, y, w, h) {
    const items = (slices || []).filter((s) => (s.count || s.value || 0) > 0);
    if (!items.length || w <= 0 || h <= 0) return [];
    const total = items.reduce((s, d) => s + (d.count || d.value || 0), 0);
    if (items.length === 1) return [{ ...items[0], x, y, w, h }];
    const mid = Math.ceil(items.length / 2);
    const left = items.slice(0, mid);
    const right = items.slice(mid);
    const leftSum = left.reduce((s, d) => s + (d.count || d.value || 0), 0);
    const ratio = leftSum / total;
    if (w >= h) {
      const lw = w * ratio;
      return [...treemapLayout(left, x, y, lw, h), ...treemapLayout(right, x + lw, y, w - lw, h)];
    }
    const lh = h * ratio;
    return [...treemapLayout(left, x, y, w, lh), ...treemapLayout(right, x, y + lh, w, h - lh)];
  }

  function treemapHtml(slices, title, total) {
    const norm = (slices || []).map((s) => ({
      ...s,
      count: s.count ?? s.value ?? 0,
      pct: s.pct ?? (total ? Math.round(1000 * (s.count ?? s.value ?? 0) / total) / 10 : 0),
      internal: s.internal || String(s.label || "").includes("interne"),
    })).filter((s) => s.count > 0);
    if (!norm.length) {
      return `<div class="treemap-wrap"><p class="treemap-title">${esc(title)}</p><p class="hint">Aucune interaction.</p></div>`;
    }
    const W = 280, H = 150, PAD = 1;
    const rects = treemapLayout(norm, PAD, PAD, W - 2 * PAD, H - 2 * PAD);
    const svgRects = rects.map((r) => {
      const show = r.w > 34 && r.h > 16;
      const short = String(r.label || "").replace(" · interne", "*");
      const label = show ? `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 - (r.h > 28 ? 4 : 0)}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="9" font-weight="600">${esc(short)}</text>` : "";
      const pct = show && r.h > 28 ? `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 9}" text-anchor="middle" fill="#e8eaed" font-size="8" opacity="0.9">${r.pct}%</text>` : "";
      return `<g>
        <rect x="${r.x}" y="${r.y}" width="${Math.max(0, r.w)}" height="${Math.max(0, r.h)}" fill="${esc(r.color)}" stroke="${r.internal ? "#fff" : "#0f1117"}" stroke-width="${r.internal ? 1.5 : 0.8}" opacity="0.92"/>
        ${label}${pct}
      </g>`;
    }).join("");
    const legend = norm.slice(0, 8).map((s) =>
      `<li><span class="treemap-dot" style="background:${esc(s.color)}"></span>${esc(s.label)}${s.hub ? " @" + esc(s.hub) : ""} · ${s.pct}% (${fmt(s.count)})</li>`
    ).join("");
    return `<div class="treemap-wrap">
      <p class="treemap-title">${esc(title)} · ${fmt(total)} interactions</p>
      <svg class="treemap-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${svgRects}</svg>
      <ul class="treemap-legend">${legend}</ul>
    </div>`;
  }

  function postCard(p) {
    const isOwn = p.isOwnContent === true;
    const target = p.target || p.author || "?";
    const contentAuthor = p.contentAuthor || p.author || "?";
    let tag = "mention", tagClass = "inbound", headline = `@${esc(contentAuthor)} → @${esc(target)}`;
    if (isOwn) {
      tag = p.type === "quote" ? "quote" : "tweet original";
      tagClass = "own";
      headline = `@${esc(target)}`;
    } else if (p.type === "reply") { tag = "reply"; tagClass = "inbound"; }
    else if (p.type === "quote") { tag = "quote"; tagClass = "inbound"; }
    else if (p.type === "retweet") { tag = "RT"; tagClass = "retweet"; }
    const eng = Number(p.engagement || 0);
    const link = p.url || (p.tweetId ? `https://x.com/${encodeURIComponent(p.author || target)}/status/${encodeURIComponent(p.tweetId)}` : "");
    return `<div class="post-card">
      <div class="post-head">
        <span class="type-tag ${tagClass}">${esc(tag)}</span>
        ${headline}${eng ? " · " + fmt(eng) + " eng." : ""} · ${esc(p.date || "")}
        ${link ? ` <a class="tweet-link" href="${esc(link)}" target="_blank" rel="noopener">ouvrir</a>` : ""}
      </div>
      <div class="post-text">${esc(p.text || "")}</div>
    </div>`;
  }

  let PHASE = null;
  let activeMetric = "inStrength";

  function renderAccounts() {
    const host = document.getElementById("accounts");
    if (!host || !PHASE) return;
    const isPr = activeMetric === "pagerank";
    const hint = document.getElementById("metric-hint");
    if (hint) {
      hint.textContent = isPr
        ? "Classement : top 5 comptes par PageRank · sous chaque compte : top 5 publications par eng. plateforme"
        : "Classement : top 5 comptes par interactions entrantes (in-strength) · sous chaque compte : top 5 publications par eng. plateforme";
    }
    document.querySelectorAll("#metric-tabs .metric-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.metric === activeMetric);
    });
    const ranks = PHASE.communityRankings || {};
    host.innerHTML = (PHASE.nodes || []).map((n) => {
      const block = ranks[String(cidOf(n))] || ranks[n.id] || {};
      const data = block[activeMetric] || { accounts: [], commTotal: 0, othersSharePct: 0, giniReceivers: 0 };
      const totalLbl = isPr ? Number(data.commTotal || 0).toFixed(4) : fmt(data.commTotal);
      const metricLbl = isPr ? "Σ PR" : "Σ in-str";
      const ov = block.interactionOverview || {};
      const rows = (data.accounts || []).slice(0, 5).map((a) => {
        const sn = a.screenName || a.screen_name;
        const valLbl = isPr ? Number(a.metricValue || a.pagerank || 0).toFixed(4) : fmt(a.metricValue ?? a.inStrength);
        const posts = (a.topPosts || a.posts || []).map(postCard).join("")
          || '<p class="hint">Aucune publication dans le corpus pour ce compte.</p>';
        return `<details class="acct-item">
          <summary>
            <span><a class="handle" href="${xUrl(sn)}" target="_blank" rel="noopener">@${esc(sn)}</a>
              <span class="acct-pct">${esc(a.sharePct)}% · ${valLbl}</span></span>
            <span class="acct-pct">in-str ${fmt(a.inStrength)} · PR ${a.pagerank ?? "—"}</span>
          </summary>
          <div class="acct-posts">${posts}</div>
        </details>`;
      }).join("");
      return `<div class="viz-box comm-acct">
        <div class="comm-head-row">
          <span class="dot" style="background:${esc(n.color)}"></span>
          ${esc(n.label)} · @${esc(n.hub)} — <span class="acct-pct">${metricLbl} ${totalLbl}</span>
        </div>
        <div class="comm-overview">
          ${treemapHtml(ov.inboundBySource, "Entrantes · par communauté source", ov.inboundTotal || 0)}
          ${treemapHtml(ov.outboundByTarget, "Sortantes · par communauté cible", ov.outboundTotal || 0)}
        </div>
        ${rows || "<p class='hint'>—</p>"}
        <div class="comm-foot">Part hors top 5 : ${esc(data.othersSharePct)}% · Gini receveurs : ${esc(data.giniReceivers)}</div>
      </div>`;
    }).join("");
  }

  function rtDash(rtPct) {
    if (rtPct == null) return "";
    if (rtPct >= 80) return "";
    if (rtPct <= 20) return "7 5";
    const dash = Math.max(4, Math.round((rtPct / 100) * 22));
    const gap = Math.max(3, Math.round(((100 - rtPct) / 100) * 14));
    return `${dash} ${gap}`;
  }

  function renderCircular(svg, ph) {
    if (!svg) return;
    const nodes = ph.nodes || [];
    const edges = ph.edges || [];
    if (!nodes.length) { svg.innerHTML = ""; return; }
    const idx = {};
    nodes.forEach((n, i) => { idx[String(n.id)] = i; });
    const CX = 290, CY = 290, R = 215, PAD = 42, NR = 38;
    const pos = nodes.map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
      return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
    });
    const maxW = Math.max(1, ...edges.map((e) => e.total || 0));
    const edgeW = (w) => 0.5 + Math.pow((w || 0) / maxW, 0.72) * 4.5;
    let defs = "<defs>";
    nodes.forEach((n) => {
      defs += `<marker id="arr-${esc(n.id)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${esc(n.color)}"/></marker>`;
    });
    defs += "</defs>";
    let html = defs;
    edges.forEach((edge) => {
      const fi = idx[String(edge.from)], ti = idx[String(edge.to)];
      if (fi == null || ti == null) return;
      const fp = pos[fi], tp = pos[ti];
      const dx = tp.x - fp.x, dy = tp.y - fp.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist, ny = dy / dist;
      const x1 = fp.x + nx * PAD, y1 = fp.y + ny * PAD;
      const x2 = tp.x - nx * PAD, y2 = tp.y - ny * PAD;
      const bend = 32 + (fi - ti) * 10;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const len = Math.hypot(mx - CX, my - CY) || 1;
      const cpx = mx + ((mx - CX) / len) * bend, cpy = my + ((my - CY) / len) * bend;
      const dash = rtDash(edge.rtPct);
      const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
      html += `<path d="M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}" fill="none" stroke="${esc(edge.sourceColor)}" stroke-width="${edgeW(edge.total)}" opacity="0.9"${dashAttr} marker-end="url(#arr-${esc(edge.from)})"/>`;
    });
    nodes.forEach((node, i) => {
      const p = pos[i];
      html += `<g>
        <circle cx="${p.x}" cy="${p.y}" r="${NR}" fill="${esc(node.color)}" fill-opacity="0.92" stroke="${esc(node.color)}" stroke-width="2"/>
        <text x="${p.x}" y="${p.y - 6}" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">${esc(node.label || ("C" + node.communityId))}</text>
        <text x="${p.x}" y="${p.y + 10}" text-anchor="middle" fill="#f5f5f5" font-size="9">@${esc(node.hub || "")}</text>
      </g>`;
    });
    svg.innerHTML = html;
  }

  function heatBg(t) {
    const x = Math.max(0, Math.min(1, t));
    const r = Math.round(24 + x * 200);
    const g = Math.round(40 + x * 80);
    const b = Math.round(70 + (1 - x) * 40);
    return `rgb(${r},${g},${b})`;
  }

  function heatmapTable(ph, mode) {
    const nodes = (ph.nodes || []).slice(0, 5);
    const links = (ph.sankey || {}).links || [];
    if (!nodes.length) return "<p class='hint'>Pas de matrice.</p>";
    const ids = nodes.map((n) => n.communityId);
    const key = (a, b) => `${a}|${b}`;
    const mat = {};
    links.forEach((l) => { mat[key(l.from, l.to)] = l.weight || 0; });
    const rowTot = {};
    const colTot = {};
    ids.forEach((a) => {
      rowTot[a] = ids.reduce((s, b) => s + (mat[key(a, b)] || 0), 0);
      colTot[a] = ids.reduce((s, b) => s + (mat[key(b, a)] || 0), 0);
    });
    const head = nodes.map((n) => `<th>C${n.communityId}<span class="hub">@${esc(n.hub)}</span></th>`).join("");
    const body = nodes.map((row) => {
      const tot = mode === "out" ? (rowTot[row.communityId] || 1) : 1;
      const cells = nodes.map((col) => {
        const raw = mat[key(row.communityId, col.communityId)] || 0;
        const den = mode === "out" ? tot : (colTot[col.communityId] || 1);
        const pct = 100 * raw / den;
        const t = Math.min(1, pct / 55);
        return `<td class="cell" style="background:${heatBg(t)}">${pct.toFixed(0)}%<span class="raw">${fmt(raw)}</span></td>`;
      }).join("");
      return `<tr><td class="rowhead">C${row.communityId} · @${esc(row.hub)}</td>${cells}</tr>`;
    }).join("");
    return `<table class="heatmap-table"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function flowsHtml(ph) {
    const edges = (ph.edges || []).slice(0, 30);
    if (!edges.length) return `<p class="hint">Aucun flux intercommunautaire (hors diagonale interne).</p>`;
    return edges.map((e) => {
      const posts = (e.topPosts || []).slice(0, 4).map((p) =>
        `<div class="post-text"><span class="flow-meta">@${esc(p.author)} → @${esc(p.target)} · ${esc(p.date)} · ${esc(p.type)}</span><br>${esc(p.text)}</div>`
      ).join("");
      return `<details class="flow-item">
        <summary>
          <span class="dot" style="background:${esc(e.sourceColor)}"></span>
          <span class="flow-title">@${esc(e.sourceHub)} → @${esc(e.targetHub)}</span>
          <span class="flow-meta">${fmt(e.total)} · RT ${fmt(e.rt)} (${esc(e.rtPct)}%)</span>
        </summary>
        <div class="flow-posts">${posts || "<p class='hint'>Pas d'exemples non-RT.</p>"}</div>
      </details>`;
    }).join("");
  }

  function pageHtml(pack) {
    const ph = pack.phase;
    const meta = ph.structureMeta || {};
    const corp = pack.corpus || {};
    const id = corp.id;
    const conn = `../../connectome/?corpus=${encodeURIComponent(id)}`;
    const switcher = CORPORA.map((c) =>
      `<a href="./${c.id}.html"${c.id === id ? ' class="active"' : ""}>${esc(c.label)}</a>`
    ).join("");
    return `
      <div class="page-header">
        <a class="back-link" href="${esc(conn)}">← Connectome ${esc(corp.label || id)}</a>
        <h1>Flux intercommunautaires · ${esc(corp.label || id)}</h1>
      </div>
      <p class="subtitle">${esc(ph.phaseLabel || "")} · ${esc(pack.source || "")}. Même partition Louvain que le connectome (seed 42). Les parts de publication mesurent les tweets dont l’auteur appartient à la communauté.</p>
      <div class="corpus-switch">${switcher}</div>
      <div class="howto-box">
        <strong>Comment lire cette page</strong>
        <ol>
          <li><strong>Donuts</strong> — part de chaque pôle (top affiché + Autres) en volume de publication, en in/out-strength, et en RT reçus.</li>
          <li><strong>Graphe circulaire</strong> — flèches = flux croisés (hors interne). Trait plein = RT ≥ 80 %, pointillé = RT ≤ 20 %.</li>
          <li><strong>Sankey</strong> — gauche = communauté <em>source</em> (émettrice), droite = communauté <em>cible</em> (réceptrice). Un ruban interne relie la même communauté des deux côtés.</li>
          <li><strong>Top 5</strong> — comptes par in-strength (ou PageRank), avec treemaps des flux et publications.</li>
        </ol>
      </div>
      <div class="kpi-row">
        <div class="kpi"><div class="v">${fmt(meta.n_tweets)}</div><div class="l">Tweets</div></div>
        <div class="kpi"><div class="v">${fmt(meta.n_users)}</div><div class="l">Utilisateurs</div></div>
        <div class="kpi"><div class="v">${fmt(meta.n_edges)}</div><div class="l">Arêtes</div></div>
        <div class="kpi"><div class="v">${meta.modularity != null ? String(meta.modularity).replace(".", ",") : "—"}</div><div class="l">Modularité</div></div>
        <div class="kpi"><div class="v">${fmt(meta.n_communities)}</div><div class="l">Communautés</div></div>
        <div class="kpi"><div class="v">${fmt((ph.top6Order || []).length)}</div><div class="l">Pôles affichés</div></div>
      </div>
      <div class="hub-note"><strong>Hub d’une communauté</strong> — ${esc(ph.hubMethodNote || "compte au plus fort degré pondéré (in + out).")}</div>
      <h2>Vue globale par communauté</h2>
      <p class="hint">Top ${(ph.top6Order || []).length} pôles + Autres · publication = tous types de tweets</p>
      <div class="donut-grid">
        <div class="viz-box"><div id="donut-pub"></div></div>
        <div class="viz-box"><div id="donut-in"></div></div>
        <div class="viz-box"><div id="donut-out"></div></div>
        <div class="viz-box"><div id="donut-rt"></div></div>
      </div>
      <div class="viz-box">
        <div class="viz-title">Volume quotidien · corpus entier</div>
        <div id="volume" class="volume-full-chart"></div>
      </div>
      <div class="viz-box">
        <div class="viz-title">Activité temporelle par communauté</div>
        <p class="hint">${esc((ph.dailyActivity || {}).note || "Publications des auteurs du cluster")}</p>
        <div id="activity" class="activity-chart"></div>
      </div>
      <div class="heatmap-duo">
        <div class="viz-box">
          <div class="viz-title">Interactions reçues · empilées (top 5)</div>
          <p class="hint">In-strength ventilé RT / reply / quote / mention</p>
          <div id="eng" class="activity-chart"></div>
        </div>
        <div class="viz-box">
          <div class="viz-title">Likes plateforme · top 5</div>
          <p class="hint">Somme des like_count des publications hors RT des membres</p>
          <div id="likes" class="activity-chart"></div>
        </div>
      </div>
      <div class="viz-box">
        <div class="viz-title">Concentration des récepteurs (top 5 / 20 / 50)</div>
        <p class="hint">Part de l’in-strength captée par les comptes les plus centraux de chaque pôle</p>
        <div id="conc" class="activity-chart"></div>
      </div>
      <div class="main-grid">
        <div>
          <div class="viz-box">
            <div class="viz-title">Graphe circulaire · flux croisés</div>
            <p class="hint">Couleur = émetteur · épaisseur ∝ volume · plein = RT élevé · pointillé = RT faible</p>
            <svg id="circ" class="circ-svg" viewBox="0 0 580 580" aria-label="Graphe circulaire"></svg>
            <div class="legend">
              <span class="legend-item"><span style="display:inline-block;width:22px;height:0;border-top:2.5px solid #9aa3b5"></span>RT ≥ 80 %</span>
              <span class="legend-item"><span style="display:inline-block;width:22px;height:0;border-top:2.5px dashed #9aa3b5"></span>RT ≤ 20 %</span>
            </div>
          </div>
          <div class="viz-box">
            <div class="viz-title">Sankey · source → cible (intra + inter)</div>
            <p class="hint" id="sankey-meta">Gauche = communauté émettrice · droite = communauté réceptrice · ruban interne = auto-flux</p>
            <svg id="sankey" class="sankey-svg" viewBox="0 0 860 400" aria-label="Sankey source vers cible"></svg>
          </div>
        </div>
        <div class="side-box">
          <h2>Interactions principales</h2>
          <p class="hint">${fmt((ph.edges || []).length)} flux croisés · exemples = reply / quote / mention</p>
          <div id="flows">${flowsHtml(ph)}</div>
        </div>
      </div>
      <div class="heatmap-duo">
        <div class="viz-box">
          <div class="viz-title">Heatmap · parts sortantes (top 5)</div>
          <p class="hint">Ligne = émetteur · cellule = % de ses interactions vers chaque destinataire · somme ligne = 100 %</p>
          <div class="heatmap-wrap">${heatmapTable(ph, "out")}</div>
        </div>
        <div class="viz-box">
          <div class="viz-title">Heatmap · parts entrantes (top 5)</div>
          <p class="hint">Colonne = récepteur · cellule = % de ses interactions reçues depuis chaque émetteur</p>
          <div class="heatmap-wrap">${heatmapTable(ph, "in")}</div>
        </div>
      </div>
      <h2>Top 5 par communauté</h2>
      <div class="howto-box">
        <strong>Comment lire / utiliser ce bloc</strong>
        <ol>
          <li>Chaque carte = une communauté Louvain du top affiché (couleur + hub).</li>
          <li>Les <strong>5 comptes</strong> sont le top 5 par <strong>interactions entrantes</strong> (in-strength). L’onglet PageRank reclasse selon la centralité.</li>
          <li><strong>Ouvrir un compte</strong> pour voir jusqu’à <strong>5 publications</strong> classées par engagement plateforme (likes + RT + replies + quotes).</li>
          <li>Les treemaps résument d’où viennent / où vont les flux de la communauté (source à gauche, cible à droite).</li>
        </ol>
      </div>
      <div class="metric-tabs" id="metric-tabs">
        <button type="button" class="metric-tab active" data-metric="inStrength">In-strength</button>
        <button type="button" class="metric-tab" data-metric="pagerank">PageRank</button>
      </div>
      <p class="hint" id="metric-hint">Classement : top 5 comptes par interactions entrantes</p>
      <div class="comm-grid" id="accounts"></div>
      <p class="subtitle" style="margin-top:28px">
        <a class="fwd-link" href="${esc(conn)}">Retour au connectome →</a>
      </p>
    `;
  }

  async function main() {
    const root = document.getElementById("app");
    if (!CORPUS) {
      root.innerHTML = "<p class='err'>Corpus manquant.</p>";
      return;
    }
    try {
      const r = await fetch(`./${encodeURIComponent(CORPUS)}.json?t=${Date.now()}`);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const pack = await r.json();
      document.title = `Flux intercommunautaires — ${pack.corpus?.label || CORPUS}`;
      PHASE = pack.phase;
      root.innerHTML = pageHtml(pack);
      const ph = pack.phase;
      const gd = ph.globalDistributions || {};
      plotDonut(document.getElementById("donut-pub"), gd.publications, "Volume de publication");
      plotDonut(document.getElementById("donut-in"), gd.inStrength, "In-strength");
      plotDonut(document.getElementById("donut-out"), gd.outStrength, "Out-strength");
      plotDonut(document.getElementById("donut-rt"), gd.rtReceived, "RT reçus");
      plotVolume(document.getElementById("volume"), ph.volumeDaily);
      plotActivity(document.getElementById("activity"), ph.dailyActivity);
      plotEngagement(document.getElementById("eng"), ph);
      plotLikes(document.getElementById("likes"), ph);
      plotConcentration(document.getElementById("conc"), ph);
      renderSankey(document.getElementById("sankey"), ph);
      renderCircular(document.getElementById("circ"), ph);
      renderAccounts();
      document.querySelectorAll("#metric-tabs .metric-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeMetric = btn.dataset.metric;
          renderAccounts();
        });
      });
    } catch (err) {
      root.innerHTML = `<p class="err">Chargement impossible — ${esc(err)}. Servir le dossier via HTTP.</p>`;
    }
  }

  main();
})();
