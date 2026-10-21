/* Analyses intercommunautaires — un corpus (données JSON locales). */
(function () {
  const CORPUS = window.INTERCOMM_CORPUS;
  const CORPORA = [
    { id: "ebola", label: "Ebola" },
    { id: "ebola_2_2026", label: "Ebola 2 · 2026" },
    { id: "hantavirus", label: "Hantavirus" },
    { id: "mpox", label: "Mpox" },
    { id: "macron_nucleaire", label: "Macron nucléaire" },
    { id: "hmpv", label: "HMPV · 2025" },
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

  function plotCommunityTreemap(el, metric) {
    if (!el || !metric?.slices?.length) return;
    const slices = metric.slices.filter((s) => s.value > 0);
    Plotly.newPlot(el, [{
      type: "treemap",
      labels: slices.map((s) => (s.hub ? `@${s.hub}` : s.label)),
      parents: slices.map(() => ""),
      values: slices.map((s) => s.value),
      marker: {
        colors: slices.map((s) => s.color),
        line: { color: "#0f1117", width: 1.5 },
      },
      textinfo: "label+percent root",
      textfont: { size: 12, color: "#fff" },
      hovertemplate: "%{label}<br>%{value:,} " + (metric.unit || "") + "<br>%{percentRoot}<extra></extra>",
      tiling: { pad: 3 },
    }], plotlyLayout({
      height: 420,
      margin: { t: 8, b: 8, l: 8, r: 8 },
    }), { responsive: true, displayModeBar: false });
  }

  function plotVolume(el, vol) {
    if (!el || !vol?.dates?.length) return;
    Plotly.newPlot(el, [{
      x: vol.dates, y: vol.counts, type: "bar",
      marker: { color: "#4d8af0" },
      hovertemplate: "%{x}<br>%{y:,} tweets<br>clic : top 5 publications du jour<extra></extra>",
    }], plotlyLayout({ height: 280, yaxis: { gridcolor: "#2a3142", title: "tweets" }, xaxis: { gridcolor: "#2a3142" } }),
    { responsive: true, displayModeBar: false }).then(() => bindDayClick(el));
  }

  function mediaLayers(daily) {
    return [
      daily && daily.media,
      daily && daily.mediaDigital,
    ].filter((b) => b && Array.isArray(b.counts) && b.counts.length);
  }

  function seriesMetricValues(s, metric) {
    const vals = metric === "engagement" ? s.engagement : s.counts;
    return Array.isArray(vals) ? vals : [];
  }

  function mediaMetricValues(block, metric) {
    const vals = metric === "engagement" ? block.engagement : block.counts;
    return Array.isArray(vals) ? vals : [];
  }

  function dayDenom(daily, metric) {
    if (metric !== "engagement") {
      const vol = PHASE && PHASE.volumeDaily;
      if (vol && vol.dates && vol.counts && vol.dates.length === (daily.dates || []).length) {
        return vol.counts;
      }
    }
    const n = (daily.dates || []).length;
    const out = Array(n).fill(0);
    (daily.series || []).forEach((s) => {
      seriesMetricValues(s, metric).forEach((v, i) => { out[i] += Number(v) || 0; });
    });
    return out;
  }

  function mediaOverlayTrace(daily, block, dash, metric) {
    const y = mediaMetricValues(block, metric);
    if (!y.length) return null;
    const denom = dayDenom(daily, metric);
    const nAcc = block.nAccounts != null ? ` · ${fmt(block.nAccounts)} comptes` : "";
    const unit = metric === "engagement" ? "engagement" : "publications";
    const custom = y.map((v, i) => {
      const d = denom[i] || 0;
      return [v, d ? (100 * v) / d : 0];
    });
    return {
      x: daily.dates,
      y,
      customdata: custom,
      name: block.label || "Médias",
      type: "scatter",
      mode: "lines",
      line: {
        color: block.color || "#f5d76e",
        width: 3.2,
        dash: dash || "dash",
      },
      fill: "none",
      hovertemplate:
        `%{fullData.name}${nAcc}<br>%{x}<br>%{customdata[0]:,} ${unit} · %{customdata[1]:.2f} % du jour<extra></extra>`,
    };
  }

  function activityTraces(daily, mode) {
    const metric = mode === "engagement" ? "engagement" : "publications";
    const stacked = mode !== "lines";
    const unit = metric === "engagement" ? "engagement" : "publications";
    const denom = dayDenom(daily, metric);
    const traces = daily.series.map((s) => {
      const y = seriesMetricValues(s, metric);
      const custom = y.map((v, i) => {
        const d = denom[i] || 0;
        return d ? (100 * v) / d : 0;
      });
      const t = {
        x: daily.dates,
        y,
        customdata: custom,
        name: s.hub ? `@${s.hub}` : s.label,
        type: "scatter",
        mode: "lines",
        line: { color: s.color, width: s.communityId === -1 ? 1.2 : 2.2 },
        hovertemplate: `%{fullData.name}<br>%{x}<br>%{y:,} ${unit} · %{customdata:.1f} % du jour<extra></extra>`,
      };
      if (stacked) t.stackgroup = "one";
      else t.fill = "none";
      return t;
    });
    const showMedia = mode === "lines" || mode === "engagement";
    if (showMedia) {
      const layers = mediaLayers(daily);
      const dashes = ["dash", "dot"];
      layers.forEach((block, i) => {
        const tr = mediaOverlayTrace(daily, block, dashes[i] || "dash", metric);
        if (tr) traces.push(tr);
      });
    }
    return traces;
  }

  function plotActivity(el, daily, mode) {
    if (!el || !daily?.series?.length) return;
    const metric = mode === "engagement" ? "engagement" : "publications";
    const hasMedia = (mode === "lines" || mode === "engagement") && mediaLayers(daily).length;
    const layoutExtra = {
      height: hasMedia ? 400 : 360,
      legend: { orientation: "h", y: 1.16 },
      hovermode: "x unified",
      xaxis: { gridcolor: "#2a3142" },
      yaxis: {
        gridcolor: "#2a3142",
        title: metric === "engagement" ? "engagement (likes compris)" : "publications",
      },
      margin: { t: 28, b: 40, l: 58, r: 12 },
    };
    Plotly.newPlot(el, activityTraces(daily, mode), plotlyLayout(layoutExtra),
      { responsive: true, displayModeBar: false }).then(() => bindDayClick(el));
  }

  function bindActivityTabs(daily) {
    const el = document.getElementById("activity");
    const hint = document.getElementById("activity-hint");
    const noteStack = (daily && daily.note) || "Publications des auteurs du cluster";
    const layers = mediaLayers(daily);
    const bits = layers.map((b) =>
      `${b.label} = ${fmt(b.nAccounts)} comptes, ${fmt(b.total)} pubs`
        + (b.engagementTotal != null ? `, ${fmt(b.engagementTotal)} eng.` : "")
    );
    const noteLines = layers.length
      ? `Même échelle que les communautés (publications / jour). Lignes or pointillée = médias traditionnels, turquoise pointillée = médias numériques. Ce ne sont pas des clusters Louvain : ce sont des comptes d’enseigne, déjà inclus dans un pôle. ${bits.join(" · ")}.`
      : "Mêmes volumes quotidiens par communauté, en courbes superposées (sans empilement).";
    const noteEng = (daily && daily.engagementNote)
      ? `${daily.engagementNote} Aires = communautés. Lignes or / turquoise = médias traditionnels / numériques, même échelle (déjà inclus dans un pôle).`
      : "Engagement reçu (likes + RT + réponses + citations) des publications hors retweet, par communauté et par type de médias.";
    document.querySelectorAll("#activity-tabs .metric-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.activity || "stack";
        document.querySelectorAll("#activity-tabs .metric-tab").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        const hints = { stack: noteStack, lines: noteLines, engagement: noteEng };
        if (hint) hint.textContent = hints[mode] || noteStack;
        plotActivity(el, daily, mode);
      });
    });
  }

  function mediaPanelHtml(daily, nTweets) {
    const layers = [
      { block: daily && daily.media, kind: "trad" },
      { block: daily && daily.mediaDigital, kind: "digital" },
    ].filter((x) => x.block);
    if (!layers.length) return "";
    const cards = layers.map(({ block, kind }) => {
      const accounts = block.accounts || block.accountsSample || [];
      const pct = nTweets ? (100 * (block.total || 0) / nTweets) : null;
      const pctLbl = pct == null ? "" : ` · ${String(pct.toFixed(pct < 1 ? 2 : 1)).replace(".", ",")} % du corpus`;
      const engLbl = block.engagementTotal != null ? ` · ${fmt(block.engagementTotal)} eng.` : "";
      const chips = accounts.map((a) =>
        `<li><a class="handle" href="${xUrl(a.l)}" target="_blank" rel="noopener">@${esc(a.l)}</a>`
        + `<span class="media-n">${fmt(a.n)} pubs</span>`
        + (a.eng != null ? `<span class="media-n">${fmt(a.eng)} eng.</span>` : "")
        + `${a.name ? `<span class="media-name">${esc(a.name)}</span>` : ""}</li>`
      ).join("");
      return `<details class="media-card media-card-${kind}">
        <summary>
          <span class="media-swatch" style="background:${esc(block.color || "#f5d76e")}"></span>
          <span class="media-title">${esc(block.label || "")}</span>
          <span class="media-kpis">${fmt(block.nAccounts)} comptes · ${fmt(block.total)} pubs${engLbl}${pctLbl}</span>
        </summary>
        <p class="hint">${esc(block.definition || "")}</p>
        <ul class="media-chips">${chips || "<li>Aucun compte détecté dans ce corpus.</li>"}</ul>
      </details>`;
    }).join("");
    return `<div class="media-panel" id="media-panel">
      <p class="media-panel-lead">Les courbes médias (onglet <em>Courbes</em>) agrègent ces comptes d’enseigne, pas un pôle Louvain. Un tweet BFM ou Cerfia est déjà compté dans sa communauté ; la ligne mesure leur volume propre, sur la même échelle.</p>
      <div class="media-grid">${cards}</div>
    </div>`;
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
      tag = p.type === "quote" ? "quote" : p.type === "reply" ? "reply" : "tweet original";
      tagClass = "own";
      headline = `@${esc(target)}`;
    } else if (p.type === "reply") { tag = "reply"; tagClass = "inbound"; }
    else if (p.type === "quote") { tag = "quote"; tagClass = "inbound"; }
    else if (p.type === "retweet") { tag = "RT"; tagClass = "retweet"; }
    const eng = Number(p.engagement || 0);
    const likesN = Number(p.likes || 0);
    const link = p.url || (p.tweetId ? `https://x.com/${encodeURIComponent(p.author || target)}/status/${encodeURIComponent(p.tweetId)}` : "");
    return `<div class="post-card">
      <div class="post-head">
        <span class="type-tag ${tagClass}">${esc(tag)}</span>
        ${headline}${eng ? " · " + fmt(eng) + " eng." : ""}${likesN ? " · " + fmt(likesN) + " likes" : ""} · ${esc(p.date || "")}
        ${link ? ` <a class="tweet-link" href="${esc(link)}" target="_blank" rel="noopener">ouvrir</a>` : ""}
      </div>
      <div class="post-text">${esc(p.text || "")}</div>
    </div>`;
  }

  let PHASE = null;
  let activeMetric = "inStrength";

  const METRIC_HINT = {
    inStrength: "Classement : top 5 comptes par interactions entrantes (in-strength) · sous chaque compte : ses 5 publications les plus engageantes (RT exclus)",
    pagerank: "Classement : top 5 comptes par PageRank · sous chaque compte : ses 5 publications les plus engageantes (RT exclus)",
    likes: "Classement : top 5 comptes par likes reçus sur leurs publications hors RT · sous chaque compte : ses 5 publications les plus engageantes (RT exclus)",
  };

  function renderAccounts() {
    const host = document.getElementById("accounts");
    if (!host || !PHASE) return;
    const isPr = activeMetric === "pagerank";
    const isLikes = activeMetric === "likes";
    const hint = document.getElementById("metric-hint");
    if (hint) hint.textContent = METRIC_HINT[activeMetric] || METRIC_HINT.inStrength;
    document.querySelectorAll("#metric-tabs .metric-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.metric === activeMetric);
    });
    const ranks = PHASE.communityRankings || {};
    host.innerHTML = (PHASE.nodes || []).map((n) => {
      const block = ranks[String(cidOf(n))] || ranks[n.id] || {};
      const data = block[activeMetric] || { accounts: [], commTotal: 0, othersSharePct: 0, giniReceivers: 0 };
      const totalLbl = isPr ? Number(data.commTotal || 0).toFixed(4) : fmt(data.commTotal);
      const metricLbl = isPr ? "Σ PR" : isLikes ? "Σ likes" : "Σ in-str";
      const ov = block.interactionOverview || {};
      const rows = (data.accounts || []).slice(0, 5).map((a) => {
        const sn = a.screenName || a.screen_name;
        const rawVal = isPr ? (a.metricValue ?? a.pagerank) : isLikes ? (a.metricValue ?? a.likes) : (a.metricValue ?? a.inStrength);
        const valLbl = isPr ? Number(rawVal || 0).toFixed(4) : fmt(rawVal);
        const posts = (a.topPosts || a.posts || []).map(postCard).join("")
          || '<p class="hint">Aucune publication hors RT dans le corpus pour ce compte.</p>';
        return `<details class="acct-item">
          <summary>
            <span><a class="handle" href="${xUrl(sn)}" target="_blank" rel="noopener">@${esc(sn)}</a>
              <span class="acct-pct">${esc(a.sharePct)}% · ${valLbl}</span></span>
            <span class="acct-pct">in-str ${fmt(a.inStrength)} · PR ${a.pagerank ?? "—"} · likes ${fmt(a.likes)}</span>
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

  function treemapSection(ph) {
    const tms = ph.communityTreemaps;
    const metrics = (tms && tms.metrics) || [];
    if (!metrics.length) return "";
    const cards = metrics.map((m) => `
      <div class="viz-box">
        <div class="viz-title">${esc(m.title)} · ${fmt(m.total)} ${esc(m.unit || "")}</div>
        <p class="hint">${esc(m.definition || "")}</p>
        <div id="treemap-${esc(m.id)}" class="community-treemap"></div>
      </div>`).join("");
    return `
      <h2>Treemaps des communautés</h2>
      <p class="hint">${esc(tms.note || "")}</p>
      <div class="treemap-grid">${cards}</div>`;
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
    const analysesHub = `../${encodeURIComponent(id)}.html`;
    const analysesAll = `../cross_corpus_analyses.html?corpus=${encodeURIComponent(id)}`;
    const switcher = CORPORA.map((c) =>
      `<a href="./${c.id}.html"${c.id === id ? ' class="active"' : ""}>${esc(c.label)}</a>`
    ).join("");
    return `
      <div class="page-header">
        <a class="back-link" href="${esc(conn)}">← Connectome ${esc(corp.label || id)}</a>
        <h1>Flux intercommunautaires · ${esc(corp.label || id)}</h1>
        <a class="fwd-link" href="${esc(analysesHub)}">Espace d’analyse</a>
        <a class="fwd-link" href="${esc(analysesAll)}">Vue corpus entier</a>
        <a class="fwd-link" href="#pole-profiles">Portrait des pôles ↓</a>
        <a class="fwd-link" href="#daily-top">Top 5 publications par jour ↓</a>
      </div>
      <p class="subtitle">${esc(ph.phaseLabel || "")} · ${esc(pack.source || "")}. Même partition Louvain que le connectome (seed 42). Les parts de publication mesurent les tweets dont l’auteur appartient à la communauté.</p>
      <div class="corpus-switch">${switcher}</div>
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
      ${treemapSection(ph)}
      <div class="viz-box">
        <div class="viz-title">Volume quotidien · corpus entier</div>
        <p class="hint">Cliquer sur une barre pour ouvrir le top 5 publications de ce jour.</p>
        <div id="volume" class="volume-full-chart day-clickable"></div>
      </div>
      <div class="viz-box">
        <div class="viz-title">Activité temporelle par communauté</div>
        <div class="metric-tabs" id="activity-tabs" role="tablist" aria-label="Mode du graphe d’activité">
          <button type="button" class="metric-tab active" role="tab" aria-selected="true" data-activity="stack">Aires empilées</button>
          <button type="button" class="metric-tab" role="tab" aria-selected="false" data-activity="lines">Courbes</button>
          <button type="button" class="metric-tab" role="tab" aria-selected="false" data-activity="engagement">Engagement</button>
        </div>
        <p class="hint" id="activity-hint">${esc((ph.dailyActivity || {}).note || "Publications des auteurs du cluster")}</p>
        <div id="activity" class="activity-chart day-clickable"></div>
        ${mediaPanelHtml(ph.dailyActivity || {}, meta.n_tweets)}
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
      ${profilesSectionHtml()}
      <h2>Top 5 par communauté</h2>
      <div class="howto-box">
        <strong>Comment lire / utiliser ce bloc</strong>
        <ol>
          <li>Chaque carte = une communauté Louvain du top affiché (couleur + hub).</li>
          <li>Les <strong>5 comptes</strong> sont le top 5 par <strong>interactions entrantes</strong> (in-strength). L’onglet PageRank reclasse selon la centralité, l’onglet Likes selon la somme des likes reçus sur les publications hors RT du compte.</li>
          <li><strong>Ouvrir un compte</strong> pour voir ses <strong>5 publications</strong> les plus engageantes (likes + RT + replies + quotes). Uniquement les publications du compte, retweets exclus.</li>
          <li>Les treemaps résument d’où viennent / où vont les flux de la communauté (source à gauche, cible à droite).</li>
        </ol>
      </div>
      <div class="metric-tabs" id="metric-tabs">
        <button type="button" class="metric-tab active" data-metric="inStrength">In-strength</button>
        <button type="button" class="metric-tab" data-metric="pagerank">PageRank</button>
        <button type="button" class="metric-tab" data-metric="likes">Likes</button>
      </div>
      <p class="hint" id="metric-hint">Classement : top 5 comptes par interactions entrantes</p>
      <div class="comm-grid" id="accounts"></div>
      ${dailyTopSectionHtml()}
      <p class="subtitle" style="margin-top:28px">
        <a class="fwd-link" href="${esc(conn)}">Retour au connectome →</a>
      </p>
    `;
  }

  /* ---------- Portrait des pôles (fichier <corpus>_profiles.json) ---------- */
  const PP_HINTS = {
    created: "Chaque courbe = part des comptes datés créés cette année-là. ≤2010 regroupe les identifiants pré-snowflake (pas de millésime fiable). Les histogrammes du dessous reprennent la même série, un pôle par carte.",
    cloud: "Taille = fréquence dans les publications hors retweet du pôle (pas une comparaison aux autres). Les @mentions et URLs sont retirées.",
    terms: "Score z du log-odds pondéré (Monroe et al. 2008) : le terme est plus fréquent dans ce pôle que dans le reste du corpus. Seuil z ≥ 1,85 et au moins 8 occurrences.",
    cooc: `<div class="pp-note">
        <p><strong>Quoi.</strong> Overlay comparatif : <em>les mêmes 32 mots, aux mêmes positions</em> sur les six pôles. Cercle creux = mot du vocabulaire global absent ou quasi absent ici. Trait = collocation dans ce pôle (NPMI). On lit les cartes les unes contre les autres, pas comme six graphes indépendants.</p>
        <p><strong>Méthode.</strong> Unité = <em>texte unique</em> (URLs et @ ôtés, 100 caractères), pas la ligne CSV : un titre YouTube recopié compte une fois. Score d’arête = NPMI (PMI normalisé, Bouma 2009), borné [−1, 1], seuil 0,12 et ≥ 3 textes uniques. Épaisseur des traits et taille des disques sont à <em>la même échelle</em> pour toutes les cartes (0 → 1 et part max du corpus).</p>
        <p><strong>Choix des mots.</strong> Top 32 du corpus entier par fréquence documentaire (textes uniques), après stopwords. Pas de shortlist par pôle : on ne sélectionne pas les mots qui avantagent une communauté. Ce qui change d’une carte à l’autre : les liens qui s’allument, et le remplissage des disques (part des textes uniques du pôle).</p>
      </div>`,
    amp: "Deux classements par pôle. Gauche : comptes sources des retweets. Droite : comptes mentionnés ou destinataires de réponse dans les publications hors RT. Le % est la part dans ce classement du pôle.",
    geo: "Gauche : lieu Twitter de la publication (place) — souvent vide. Droite : user_location déclaré, un emplacement par compte (texte libre, non normalisé).",
    links: "Gauche : noms de domaine des liens externes. Droite : URL canoniques (sans x.com / twitter.com / t.co). Les raccourcisseurs (bit.ly, etc.) ne sont pas dépliés : unwound_url est vide dans ces exports.",
    hash: "Hashtags des publications hors RT, surreprésentés dans le pôle vs le reste du corpus (même log-odds que les termes, z ≥ 1,6 et n ≥ 5).",
  };
  let PP = null;
  let ppMode = "created";

  function profilesSectionHtml() {
    return `
      <section class="pole-profiles" id="pole-profiles" aria-labelledby="pp-title">
        <div class="pp-intro">
          <h2 id="pp-title">Portrait des pôles</h2>
          <p class="hint">Communautés principales uniquement (hors Autres). Dates reconstituées par snowflake Twitter — les CSV n’ont pas de <code>user_created_at</code>. Lexique = tweets originaux, réponses et citations des membres.</p>
        </div>
        <div class="metric-tabs" id="pp-tabs" role="tablist" aria-label="Vue du portrait des pôles">
          <button type="button" class="metric-tab active" role="tab" aria-selected="true" data-pp="created">Dates de création</button>
          <button type="button" class="metric-tab" role="tab" aria-selected="false" data-pp="cloud">Nuages de termes</button>
          <button type="button" class="metric-tab" role="tab" aria-selected="false" data-pp="terms">Termes surreprésentés</button>
          <button type="button" class="metric-tab" role="tab" aria-selected="false" data-pp="cooc">Co-occurrences</button>
          <button type="button" class="metric-tab" role="tab" aria-selected="false" data-pp="amp">Cibles d’amplification</button>
          <button type="button" class="metric-tab" role="tab" aria-selected="false" data-pp="geo">Origine géographique</button>
          <button type="button" class="metric-tab" role="tab" aria-selected="false" data-pp="links">Domaines & URL</button>
          <button type="button" class="metric-tab" role="tab" aria-selected="false" data-pp="hash">Hashtags distinctifs</button>
        </div>
        <p class="hint" id="pp-hint"></p>
        <div class="viz-box pp-overlay-box" id="pp-overlay-box" hidden>
          <div class="viz-title">Part des comptes par année de création</div>
          <div id="pp-overlay" class="pp-overlay-chart"></div>
        </div>
        <div class="pp-grid" id="pp-grid"><p class="hint">Chargement des profils…</p></div>
      </section>`;
  }

  function ppHead(c) {
    const med = c.medianYear != null ? String(c.medianYear) : "—";
    const recent = String(c.pctRecent ?? "—").replace(".", ",");
    return `<header class="pp-head">
      <span class="dot" style="background:${esc(c.color)}"></span>
      <div class="pp-head-txt">
        <div class="pp-name">${esc(c.label)} · <a class="handle" href="${xUrl(c.hub)}" target="_blank" rel="noopener">@${esc(c.hub)}</a></div>
        <div class="pp-meta">${fmt(c.nUsers)} comptes · médiane ${esc(med)} · ${esc(recent)} % nés 2024–26 · ${fmt(c.nOwnPubs)} pubs hors RT</div>
      </div>
    </header>`;
  }

  function sparkCreated(c, labels) {
    const shares = c.createdShare || [];
    const mx = Math.max(...shares, 0.8);
    const w = 440, h = 132, l = 6, r = 6, t = 10, b = 28;
    const iw = w - l - r, ih = h - t - b;
    const n = labels.length || 1;
    const bw = iw / n;
    const bars = shares.map((sh, i) => {
      const bh = (sh / mx) * ih;
      const x = l + i * bw;
      const y = t + ih - bh;
      return `<rect x="${(x + 0.5).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(bw - 1, 0.7).toFixed(1)}" height="${Math.max(bh, 0).toFixed(1)}" fill="${esc(c.color)}"/>`;
    }).join("");
    const ticks = labels.map((lab, i) => {
      const y = 2010 + i;
      if (y !== 2010 && y !== 2014 && y !== 2018 && y !== 2022 && y !== 2026) return "";
      const x = l + i * bw + bw / 2;
      return `<text x="${x.toFixed(1)}" y="${h - 8}" text-anchor="middle" fill="#9aa3b5" font-size="9">${esc(lab)}</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${w} ${h}" class="pp-spark" aria-label="Création des comptes ${esc(c.label)}">${bars}${ticks}</svg>`;
  }

  function svgCloud(c) {
    if (!c.cloud || !c.cloud.length) {
      return `<p class="hint">Lexique trop mince — ${fmt(c.nOwnPubs)} publication(s) hors RT.</p>`;
    }
    const words = c.cloud.map((w) => {
      const op = Math.min(1, 0.52 + (w.s / 36));
      const wt = w.s >= 20 ? 650 : 500;
      return `<text x="${w.x}" y="${w.y}" text-anchor="middle" dominant-baseline="middle" fill="${esc(c.color)}" font-size="${w.s}" font-weight="${wt}" opacity="${op.toFixed(2)}">${esc(w.t)}</text>`;
    }).join("");
    return `<svg viewBox="-40 -32 520 292" class="pp-cloud" overflow="visible" role="img" aria-label="Nuage ${esc(c.label)}">${words}</svg>`;
  }

  function rankRows(c, items, opts) {
    const empty = opts.empty || "Rien à afficher.";
    const scoreKey = opts.score || "n";
    if (!items || !items.length) return `<p class="hint">${empty}</p>`;
    const mx = Math.max(...items.map((it) => Number(it[scoreKey]) || 0), 0.001);
    return `<div class="pp-terms">${items.map((it) => {
      const pct = 100 * (Number(it[scoreKey]) || 0) / mx;
      const lab = opts.label(it);
      const sc = opts.format(it);
      const title = opts.title ? opts.title(it) : "";
      return `<div class="pp-term" title="${esc(title)}">
        <span class="pp-term-t">${lab}</span>
        <span class="pp-term-bar"><i style="width:${pct.toFixed(1)}%;background:${esc(c.color)}"></i></span>
        <span class="pp-term-z">${sc}</span>
      </div>`;
    }).join("")}</div>`;
  }

  function handleLab(it) {
    return `<a class="handle" href="${xUrl(it.t)}" target="_blank" rel="noopener">@${esc(it.t)}</a>`;
  }

  function shortUrl(u) {
    return String(u || "").replace(/^https?:\/\//, "").replace(/^www\./, "");
  }

  function duo(titleA, htmlA, titleB, htmlB) {
    return `<div class="pp-duo">
      <div class="pp-pane"><div class="pp-sub">${titleA}</div>${htmlA}</div>
      <div class="pp-pane"><div class="pp-sub">${titleB}</div>${htmlB}</div>
    </div>`;
  }

  function ampHtml(c) {
    const rt = rankRows(c, c.rtTargets, {
      empty: `Aucun retweet identifié (${fmt(c.nRt)} RT).`,
      label: handleLab,
      format: (it) => `${fmt(it.n)}`,
      title: (it) => `@${it.t} · ${it.n} RT · ${String(it.pct).replace(".", ",")} %`,
    });
    const men = rankRows(c, c.mentions, {
      empty: "Aucune mention hors RT.",
      label: handleLab,
      format: (it) => `${fmt(it.n)}`,
      title: (it) => `@${it.t} · ${it.n} mentions · ${String(it.pct).replace(".", ",")} %`,
    });
    return duo(`Top retweets · ${fmt(c.nRt)} RT`, rt, `Top mentions · ${fmt(c.nMentions)} hors RT`, men);
  }

  function geoHtml(c) {
    const pubs = rankRows(c, c.geoPubs, {
      empty: `Aucune publication géolocalisée (place Twitter) — ${fmt(c.nGeoPubs)} / ${fmt(c.nTweets)}.`,
      label: (it) => esc(it.t),
      format: (it) => `${fmt(it.n)}`,
      title: (it) => `${it.t} · ${it.n} pubs · ${String(it.pct).replace(".", ",")} %`,
    });
    const aut = rankRows(c, c.geoAuthors, {
      empty: "Aucun user_location déclaré.",
      label: (it) => esc(it.t),
      format: (it) => `${fmt(it.n)}`,
      title: (it) => `${it.t} · ${it.n} comptes · ${String(it.pct).replace(".", ",")} %`,
    });
    return duo(`Publications · place (${fmt(c.nGeoPubs)})`, pubs, `Auteurs · user_location (${fmt(c.nGeoAuthors)})`, aut);
  }

  function linksHtml(c) {
    const dom = rankRows(c, c.domains, {
      empty: "Aucun domaine externe.",
      label: (it) => esc(it.t),
      format: (it) => `${fmt(it.n)}`,
      title: (it) => `${it.t} · ${it.n} · ${String(it.pct).replace(".", ",")} %`,
    });
    const urls = rankRows(c, c.urls, {
      empty: "Aucune URL externe.",
      label: (it) => `<a class="handle pp-url" href="${esc(it.t)}" target="_blank" rel="noopener">${esc(shortUrl(it.t))}</a>`,
      format: (it) => `${fmt(it.n)}`,
      title: (it) => `${it.t} · ${it.n} · ${String(it.pct).replace(".", ",")} %`,
    });
    return duo("Top domaines", dom, "Top URL", urls);
  }

  function hashHtml(c) {
    return rankRows(c, c.hashtags, {
      empty: "Aucun hashtag distinctif au seuil.",
      score: "z",
      label: (it) => `<span class="pp-hash">#${esc(it.t)}</span>`,
      format: (it) => String(it.z).replace(".", ","),
      title: (it) => `#${it.t} · ${it.n} occ. · z = ${String(it.z).replace(".", ",")}`,
    });
  }

  function termsBars(c) {
    if (!c.terms || !c.terms.length) {
      return `<p class="hint">Aucun terme distinctif au seuil (souvent un pôle quasi exclusivement relais : ${fmt(c.nOwnPubs)} pubs hors RT).</p>`;
    }
    const mx = Math.max(...c.terms.map((t) => t.z), 1);
    return `<div class="pp-terms">${c.terms.map((t) => {
      const pct = 100 * t.z / mx;
      return `<div class="pp-term" title="${esc(t.t)} · ${fmt(t.n)} occ. · z = ${String(t.z).replace(".", ",")}">
        <span class="pp-term-t">${esc(t.t)}</span>
        <span class="pp-term-bar"><i style="width:${pct.toFixed(1)}%;background:${esc(c.color)}"></i></span>
        <span class="pp-term-z">${String(t.z).replace(".", ",")}</span>
      </div>`;
    }).join("")}</div>`;
  }

  function svgCooc(c) {
    const shared = PP.coocShared || {};
    const g = c.cooc || {};
    const vocab = shared.vocab || (g.nodes || []).map((n) => n.t);
    if (!vocab.length) {
      return `<p class="hint">Vocabulaire commun indisponible.</p>`;
    }
    const byShare = Object.fromEntries((g.nodes || []).map((n) => [n.t, n]));
    const maxShare = Math.max(Number(shared.maxShare) || 0, 0.08);
    const W = 780, H = 780, cx = 390, cy = 390, font = 11;
    const ring = 242;
    const n = vocab.length;
    const placed = vocab.map((t, i) => {
      const ang = (2 * Math.PI * i / n) - Math.PI / 2;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const rec = byShare[t] || { t, n: 0, share: 0 };
      const share = Number(rec.share) || 0;
      const used = share > 0.002;
      const r = used ? 3.6 + 12.5 * Math.sqrt(share / maxShare) : 3.4;
      const x = cx + ring * cos;
      const y = cy + ring * sin;
      let anchor = "middle";
      let lx = x, ly = y;
      if (cos > 0.32) { anchor = "start"; lx = x + r + 7; ly = y + 3; }
      else if (cos < -0.32) { anchor = "end"; lx = x - r - 7; ly = y + 3; }
      else if (sin < 0) ly = y - r - 8;
      else ly = y + r + 13;
      return { t, r, x, y, lx, ly, anchor, share, used, n: rec.n || 0 };
    });
    const byId = Object.fromEntries(placed.map((p) => [p.t, p]));
    const nEd = (g.edges || []).length;
    const nDocs = g.nDocs != null ? g.nDocs : c.nUniqueTexts;
    const npmiMin = shared.npmiMin ?? 0.12;
    const guide = `<circle cx="${cx}" cy="${cy}" r="${ring}" fill="none" stroke="#2a3142" stroke-width="1" stroke-dasharray="3 7" opacity="0.7"/>`;
    const edges = (g.edges || []).map((e) => {
      const a = byId[e.a], b = byId[e.b];
      if (!a || !b) return "";
      const npmi = Math.max(0, Math.min(1, Number(e.npmi != null ? e.npmi : e.pmi) || 0));
      const w = 0.55 + 3.6 * npmi;
      const op = 0.16 + 0.74 * npmi;
      const pct = ((e.n || 0) / Math.max(nDocs, 1) * 100).toFixed(1).replace(".", ",");
      return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${esc(c.color)}" stroke-width="${w.toFixed(2)}" opacity="${op.toFixed(2)}" stroke-linecap="round">
        <title>${esc(e.a)} · ${esc(e.b)} · NPMI ${String(npmi).replace(".", ",")} · ${fmt(e.n)} textes (${pct} %)</title>
      </line>`;
    }).join("");
    const nodes = placed.map((p) => {
      const pct = (100 * p.share).toFixed(1).replace(".", ",");
      const hole = !p.used;
      const circ = hole
        ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="none" stroke="#6a7382" stroke-width="1.2" opacity="0.55"/>`
        : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="${esc(c.color)}" opacity="0.92"/>`;
      const tc = hole ? "#7a8494" : "#e8eaed";
      return `<g>
        ${circ}
        <text x="${p.lx.toFixed(1)}" y="${p.ly.toFixed(1)}" text-anchor="${p.anchor}" dominant-baseline="middle" fill="${tc}" font-size="${font}" font-weight="${hole ? 400 : 600}">${esc(p.t)}</text>
        <title>${esc(p.t)} · ${fmt(p.n)} / ${fmt(nDocs)} textes (${pct} %)</title>
      </g>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="pp-cooc" role="img" aria-label="Co-occurrences overlay ${esc(c.label)}">${guide}${edges}${nodes}</svg>
      <p class="pp-cap">${fmt(nDocs)} textes uniques · ${fmt(nEd)} arêtes NPMI ≥ ${String(npmiMin).replace(".", ",")} · disque = part des textes (échelle commune) · cercle creux = mot du vocabulaire global absent ici</p>`;
  }

  function plotCreatedOverlay(el, pack) {
    if (!el || !pack?.communities?.length) return;
    const traces = pack.communities.map((c) => ({
      x: pack.yearLabels,
      y: c.createdShare,
      type: "scatter",
      mode: "lines",
      name: `${c.label} @${c.hub}`,
      line: { color: c.color, width: 2.2, shape: "spline", smoothing: 0.6 },
      hovertemplate: "%{x}<br>%{y:.1f} % des comptes datés<extra>" + c.label + "</extra>",
    }));
    Plotly.newPlot(el, traces, plotlyLayout({
      height: 290,
      yaxis: { title: "% des comptes datés", gridcolor: "#2a3142", rangemode: "tozero", ticksuffix: " %" },
      xaxis: { gridcolor: "#2a3142", tickangle: -40 },
      legend: { orientation: "h", y: -0.32, font: { size: 10 } },
      margin: { t: 12, b: 78, l: 56, r: 14 },
    }), { responsive: true, displayModeBar: false });
  }

  function renderProfiles() {
    const grid = document.getElementById("pp-grid");
    const hint = document.getElementById("pp-hint");
    const box = document.getElementById("pp-overlay-box");
    const overlay = document.getElementById("pp-overlay");
    if (!grid || !PP) return;
    if (hint) hint.innerHTML = PP_HINTS[ppMode] || "";
    const showOverlay = ppMode === "created";
    if (box) box.hidden = !showOverlay;
    if (showOverlay && overlay) {
      requestAnimationFrame(() => plotCreatedOverlay(overlay, PP));
    } else if (overlay && window.Plotly) Plotly.purge(overlay);
    const labels = PP.yearLabels || [];
    grid.innerHTML = (PP.communities || []).map((c) => {
      let body = "";
      if (ppMode === "created") body = sparkCreated(c, labels);
      else if (ppMode === "cloud") body = svgCloud(c);
      else if (ppMode === "terms") body = termsBars(c);
      else if (ppMode === "cooc") body = svgCooc(c);
      else if (ppMode === "amp") body = ampHtml(c);
      else if (ppMode === "geo") body = geoHtml(c);
      else if (ppMode === "links") body = linksHtml(c);
      else if (ppMode === "hash") body = hashHtml(c);
      else body = svgCooc(c);
      return `<article class="pp-card" style="--pp:${esc(c.color)}">${ppHead(c)}<div class="pp-body">${body}</div></article>`;
    }).join("");
  }

  function bindProfileTabs() {
    document.querySelectorAll("#pp-tabs .metric-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        ppMode = btn.dataset.pp;
        document.querySelectorAll("#pp-tabs .metric-tab").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        renderProfiles();
      });
    });
  }

  function applyProfiles(data) {
    const grid = document.getElementById("pp-grid");
    if (!grid) return;
    PP = data;
    bindProfileTabs();
    renderProfiles();
  }

  function initProfiles(preloaded) {
    const grid = document.getElementById("pp-grid");
    if (!grid) return;
    if (preloaded) {
      applyProfiles(preloaded);
      return;
    }
    fetch(`./${encodeURIComponent(CORPUS)}_profiles.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then(applyProfiles)
      .catch((err) => {
        grid.innerHTML = `<p class="hint">Profils indisponibles — ${esc(err)}.</p>`;
      });
  }

  /* ---------- Top 5 publications par jour (fichier <corpus>_daily_top.json) ---------- */
  const DT_MODES = {
    engagement: {
      key: "e",
      unit: "eng. hors likes",
      score: (p) => (p.rt || 0) + (p.rp || 0) + (p.qt || 0),
      hint: "Classement par retweets + réponses + citations reçus (likes exclus). Le total du jour et la part de chaque publication portent sur l’ensemble des publications hors RT de ce jour.",
      empty: "Aucune publication avec retweet, réponse ou citation ce jour.",
    },
    likes: {
      key: "l",
      unit: "likes",
      score: (p) => p.lk || 0,
      hint: "Classement par likes reçus uniquement. Le total du jour et la part de chaque publication portent sur l’ensemble des publications hors RT de ce jour.",
      empty: "Aucune publication likée ce jour.",
    },
  };
  const DT_TYPES = {
    original: { label: "Tweet original", cls: "original" },
    reply: { label: "Réponse", cls: "reply" },
    quote: { label: "Citation", cls: "quote" },
  };
  const DT_MEDIA = { photo: ["photo", "photos"], video: ["vidéo", "vidéos"], animated_gif: ["GIF", "GIF"] };
  const DT_DAY_MS = 86400000;
  const DT = {
    data: null, mode: "engagement", week: 0, peakWeek: 0,
    byDay: {}, weekOfDay: {}, comm: {}, pending: null, currentDay: null, spy: null,
  };
  const DT_FMT = {
    weekday: new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }),
    weekdayShort: new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }),
    month: new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }),
    monthShort: new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }),
    compact: new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }),
  };
  const DT_TOKEN = /(https?:\/\/\S+)|(^|[^\p{L}\p{N}_@#&])([@#])([\p{L}\p{N}_]+)/gu;

  const utcDate = (d) => new Date(`${d}T00:00:00Z`);
  const isoDay = (dt) => dt.toISOString().slice(0, 10);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const frDay = (dt) => (dt.getUTCDate() === 1 ? "1er" : String(dt.getUTCDate()));
  const compact = (n) => DT_FMT.compact.format(n || 0);
  const dayTotal = (day, mode) => Number((mode === "likes" ? day.lt : day.et) || 0);
  const pctFr = (x) => {
    if (!(x > 0)) return "0 %";
    if (x < 0.1) return "< 0,1 %";
    const n = x >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
    return `${String(n).replace(".", ",")} %`;
  };
  const longDate = (d) => {
    const dt = utcDate(d);
    return `${DT_FMT.weekday.format(dt)} ${frDay(dt)} ${DT_FMT.month.format(dt)} ${dt.getUTCFullYear()}`;
  };
  const shortDate = (d) => {
    const dt = utcDate(d);
    return `${frDay(dt)} ${DT_FMT.monthShort.format(dt)} ${dt.getUTCFullYear()}`;
  };
  const weekNo = (w) => Number(String(w.id).split("-W")[1]);
  const weekDates = (w) => {
    const start = utcDate(w.start).getTime();
    return Array.from({ length: 7 }, (_, i) => isoDay(new Date(start + i * DT_DAY_MS)));
  };
  const weekVolume = (w) => weekDates(w).reduce((s, d) => s + ((DT.byDay[d] || {}).n || 0), 0);
  const statusUrl = (handle, id) => `https://x.com/${encodeURIComponent(handle || "i")}/status/${encodeURIComponent(id)}`;

  function weekRange(w) {
    const s = utcDate(w.start), e = utcDate(w.end);
    const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
    const sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth();
    const left = frDay(s) + (sameMonth ? "" : ` ${DT_FMT.month.format(s)}`) + (sameYear ? "" : ` ${s.getUTCFullYear()}`);
    return `du ${left} au ${frDay(e)} ${DT_FMT.month.format(e)} ${e.getUTCFullYear()}`;
  }

  function richText(raw) {
    const text = String(raw || "").replace(/ {2,}/g, "\n");
    let html = "", last = 0;
    for (const m of text.matchAll(DT_TOKEN)) {
      html += esc(text.slice(last, m.index));
      if (m[1]) {
        const url = m[1].replace(/[.,;:!?)\]»”"'…]+$/u, "");
        html += `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>${esc(m[1].slice(url.length))}`;
      } else {
        const word = m[4];
        const href = m[3] === "@" ? xUrl(word) : `https://x.com/hashtag/${encodeURIComponent(word)}`;
        html += `${esc(m[2])}<a class="dt-tag" href="${esc(href)}" target="_blank" rel="noopener">${esc(m[3] + word)}</a>`;
      }
      last = m.index + m[0].length;
    }
    return html + esc(text.slice(last));
  }

  function dtTextBlock(raw) {
    return `<div class="dt-text">${richText(raw)}</div>`;
  }

  function dtCommChip(cid) {
    if (cid == null) return "";
    const node = DT.comm[cid];
    if (!node) {
      return `<span class="dt-comm dt-comm--other" title="Communauté Louvain C${esc(cid)}, hors pôles affichés sur la page">autre communauté</span>`;
    }
    return `<span class="dt-comm" style="--comm:${esc(node.color)}" title="Pôle ${esc(node.label)} · hub @${esc(node.hub)}"><span class="dot" style="background:${esc(node.color)}"></span>${esc(node.label)} · @${esc(node.hub)}</span>`;
  }

  function dtMediaHtml(p) {
    const items = p.m || [];
    if (!items.length && !p.s) return "";
    const thumbs = items.filter((m) => m.u).slice(0, 4).map((m) =>
      `<a class="dt-thumb" href="${esc(m.u)}?name=large" target="_blank" rel="noopener" title="Ouvrir l’image"><img src="${esc(m.u)}?name=small" alt="Image jointe à la publication" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></a>`
    ).join("");
    const counts = {};
    items.forEach((m) => { counts[m.k] = (counts[m.k] || 0) + 1; });
    const tags = Object.entries(counts).map(([k, n]) => {
      const lbl = DT_MEDIA[k] || [k, k];
      return `<span class="dt-media-tag">${n > 1 ? `${n} ` : ""}${esc(lbl[n > 1 ? 1 : 0])}</span>`;
    }).join("");
    const warn = p.s ? `<span class="dt-media-tag dt-media-tag--warn">média signalé sensible · non affiché</span>` : "";
    return `<div class="dt-media">${thumbs}${tags}${warn}</div>`;
  }

  function dtQuotedHtml(p) {
    if (p.ty !== "quote") return "";
    const q = p.qd;
    if (!q) {
      return p.qId
        ? `<div class="dt-quoted dt-quoted--missing">Cite une publication absente du corpus · <a href="${esc(statusUrl("i", p.qId))}" target="_blank" rel="noopener">ouvrir sur X</a></div>`
        : "";
    }
    return `<blockquote class="dt-quoted">
      <div class="dt-quoted-head">
        <span class="dt-quoted-kicker">Publication citée</span>
        <a class="dt-quoted-author" href="${esc(xUrl(q.a))}" target="_blank" rel="noopener">${esc(q.n || q.a)}</a>
        <span class="dt-handle">@${esc(q.a)}</span>
        <span>· ${esc(shortDate(q.d))}</span>
        <a class="dt-open" href="${esc(statusUrl(q.a, q.id))}" target="_blank" rel="noopener">ouvrir</a>
      </div>
      ${dtTextBlock(q.x)}
    </blockquote>`;
  }

  function dtPostHtml(p, rank, mode, total) {
    const m = DT_MODES[mode];
    const score = m.score(p);
    const share = total > 0 ? (100 * score) / total : 0;
    const type = DT_TYPES[p.ty] || { label: p.ty, cls: "original" };
    const thread = p.ty === "reply" && p.re && p.re.toLowerCase() === String(p.a).toLowerCase();
    const node = DT.comm[p.c];
    const name = p.n || p.a;
    const initial = (Array.from(name.replace(/^[^\p{L}\p{N}]+/u, ""))[0] || "?").toUpperCase();
    const verified = p.v
      ? `<svg class="dt-verified" viewBox="0 0 24 24" role="img" aria-label="Compte certifié"><title>Compte certifié</title><circle cx="12" cy="12" r="10"/><path d="M7.5 12.4l3 3 6-6.4"/></svg>`
      : "";
    const context = p.ty === "reply" && p.re
      ? `<div class="dt-context">${thread ? "Suite d’un fil de" : "En réponse à"} <a href="${esc(xUrl(p.re))}" target="_blank" rel="noopener">@${esc(p.re)}</a>${p.reId ? ` · <a href="${esc(statusUrl(p.re, p.reId))}" target="_blank" rel="noopener">publication d’origine</a>` : ""}</div>`
      : "";
    const breakdown = `<div class="dt-break${mode === "likes" ? " is-secondary" : ""}">
        <span title="Retweets">RT <b>${fmt(p.rt)}</b></span>
        <span title="Réponses">Rép. <b>${fmt(p.rp)}</b></span>
        <span title="Citations">Cit. <b>${fmt(p.qt)}</b></span>
      </div>`;
    const likesLine = `<div class="dt-alt${mode === "likes" ? "" : " is-secondary"}">${mode === "likes" ? `${fmt(DT_MODES.engagement.score(p))} eng. hors likes` : `${fmt(p.lk)} likes`}</div>`;
    const extra = [p.bm ? `${fmt(p.bm)} signets` : "", p.im ? `${fmt(p.im)} impressions` : ""].filter(Boolean).join(" · ");
    return `<article class="dt-post" style="--comm:${esc(node ? node.color : "#5b6477")}">
      <div class="dt-rank dt-rank--${rank}" aria-label="Rang ${rank}">${rank}</div>
      <div class="dt-main">
        <header class="dt-head">
          <a class="dt-author" href="${esc(xUrl(p.a))}" target="_blank" rel="noopener">
            <span class="dt-avatar" aria-hidden="true">${esc(initial)}</span>
            <span class="dt-id"><span class="dt-name">${esc(name)}</span><span class="dt-handle">@${esc(p.a)}</span></span>
          </a>
          ${verified}
          <span class="dt-type dt-type--${type.cls}">${esc(thread ? "Réponse · fil" : type.label)}</span>
          ${dtCommChip(p.c)}
          <time class="dt-time" datetime="${esc(p.d)}T${esc(p.t)}Z">${esc(p.t)} UTC</time>
        </header>
        ${context}
        ${dtTextBlock(p.x)}
        ${dtQuotedHtml(p)}
        ${dtMediaHtml(p)}
        <footer class="dt-foot">
          <a href="${esc(statusUrl(p.a, p.id))}" target="_blank" rel="noopener">Ouvrir sur X ↗</a>
        </footer>
      </div>
      <aside class="dt-score" aria-label="Engagement">
        <div class="dt-score-v">${fmt(score)}</div>
        <div class="dt-score-l">${esc(m.unit)}</div>
        <div class="dt-share" title="${fmt(score)} / ${fmt(total)} ${esc(m.unit)} du jour">
          <div class="dt-share-v">${pctFr(share)}</div>
          <div class="dt-share-l">${mode === "likes" ? "des likes du jour" : "de l’eng. du jour"}</div>
        </div>
        ${mode === "likes" ? likesLine + breakdown : breakdown + likesLine}
        ${extra ? `<div class="dt-alt is-secondary">${extra}</div>` : ""}
      </aside>
    </article>`;
  }

  function dtDayHtml(day, mode) {
    const m = DT_MODES[mode];
    const list = (day[m.key] || []).map((i) => DT.data.posts[i]);
    const total = dayTotal(day, mode);
    let body;
    if (!day.n) body = `<p class="dt-empty">Aucune publication collectée ce jour.</p>`;
    else if (!list.length) body = `<p class="dt-empty">${esc(m.empty)}</p>`;
    else body = list.map((p, i) => dtPostHtml(p, i + 1, mode, total)).join("");
    const few = list.length && list.length < DT.data.topK
      ? `<p class="dt-note">${list.length} publication${list.length > 1 ? "s" : ""} seulement avec un score non nul ce jour.</p>`
      : "";
    return `<section class="dt-day" id="dt-day-${esc(day.d)}" data-day="${esc(day.d)}">
      <header class="dt-day-head">
        <h3 class="dt-day-title">${esc(cap(longDate(day.d)))}</h3>
        <div class="dt-day-meta">
          <span><b>${fmt(day.n)}</b> tweets</span>
          <span><b>${fmt(day.o)}</b> hors RT</span>
          ${total ? `<span>total : <b>${fmt(total)}</b> ${esc(m.unit)}</span>` : ""}
        </div>
      </header>
      <div class="dt-list">${body}</div>
      ${few}
    </section>`;
  }

  function dtStripHtml(week, mode) {
    const m = DT_MODES[mode];
    const dates = weekDates(week);
    const maxN = Math.max(1, ...dates.map((d) => (DT.byDay[d] || {}).n || 0));
    const tiles = dates.map((d) => {
      const day = DT.byDay[d];
      const dt = utcDate(d);
      const wd = DT_FMT.weekdayShort.format(dt).replace(".", "");
      if (!day) {
        return `<div class="dt-tile is-out" aria-hidden="true"><span class="dt-tile-wd">${esc(wd)}</span><span class="dt-tile-d">${frDay(dt)} <small>${esc(DT_FMT.monthShort.format(dt))}</small></span><span class="dt-tile-n">hors corpus</span></div>`;
      }
      const total = dayTotal(day, mode);
      return `<button type="button" class="dt-tile${d === DT.currentDay ? " is-current" : ""}" data-dt-day="${esc(d)}" title="${esc(cap(longDate(d)))} · ${fmt(day.n)} tweets · ${fmt(total)} ${esc(m.unit)}">
        <span class="dt-tile-wd">${esc(wd)}</span>
        <span class="dt-tile-d">${frDay(dt)} <small>${esc(DT_FMT.monthShort.format(dt))}</small></span>
        <span class="dt-tile-n">${compact(day.n)} tweets</span>
        <span class="dt-tile-top">${compact(total)} ${esc(mode === "likes" ? "likes" : "eng.")}</span>
        <span class="dt-tile-bar"><span style="width:${Math.round((100 * day.n) / maxN)}%"></span></span>
      </button>`;
    }).join("");
    return `<div class="dt-strip" role="group" aria-label="Jours de la semaine">${tiles}</div>`;
  }

  function dtTimelineHtml() {
    const weeks = DT.data.weeks;
    if (weeks.length < 2) return "";
    const vols = weeks.map(weekVolume);
    const max = Math.max(1, ...vols);
    const bars = weeks.map((w, i) => {
      const cls = `dt-tl${i === DT.week ? " is-active" : ""}${i === DT.peakWeek ? " is-peak" : ""}`;
      const label = `Semaine ${weekNo(w)} · ${weekRange(w)} · ${fmt(vols[i])} tweets${i === DT.peakWeek ? " · pic du corpus" : ""}`;
      return `<button type="button" class="${cls}" data-dt-week="${i}" title="${esc(label)}" aria-label="${esc(label)}"${i === DT.week ? ' aria-current="true"' : ""}><span class="dt-tl-bar" style="height:${Math.max(8, Math.round((100 * vols[i]) / max))}%"></span></button>`;
    }).join("");
    return `<div class="dt-timeline-wrap">
      <div class="dt-timeline-head"><span>Volume hebdomadaire · cliquer une semaine</span><span class="dt-legend-peak">pic du corpus</span></div>
      <div class="dt-timeline">${bars}</div>
      <div class="dt-tl-axis"><span>${esc(shortDate(weeks[0].start))}</span><span>${esc(shortDate(weeks[weeks.length - 1].end))}</span></div>
    </div>`;
  }

  function dtNavHtml(where) {
    const weeks = DT.data.weeks;
    const w = weeks[DT.week];
    const prev = DT.week > 0, next = DT.week < weeks.length - 1;
    if (where === "bottom") {
      return `<nav class="dt-bottom-nav" aria-label="Changer de semaine">
        <button type="button" class="dt-nav-wide" data-dt-step="-1"${prev ? "" : " disabled"}>‹ Semaine précédente</button>
        <span class="dt-nav-pos">Semaine ${weekNo(w)} · ${DT.week + 1} / ${weeks.length}</span>
        <button type="button" class="dt-nav-wide" data-dt-step="1"${next ? "" : " disabled"}>Semaine suivante ›</button>
      </nav>`;
    }
    const options = weeks.map((wk, i) =>
      `<option value="${i}"${i === DT.week ? " selected" : ""}>S${weekNo(wk)} · ${esc(weekRange(wk))}${i === DT.peakWeek ? " · pic" : ""}</option>`
    ).join("");
    const peak = weeks.length > 1 && DT.week !== DT.peakWeek
      ? `<button type="button" class="dt-chip" data-dt-week="${DT.peakWeek}">Aller à la semaine du pic</button>`
      : "";
    return `<div class="dt-nav">
      <button type="button" class="dt-nav-btn" data-dt-step="-1" aria-label="Semaine précédente"${prev ? "" : " disabled"}>‹</button>
      <div class="dt-nav-label">
        <span class="dt-nav-week">Semaine ${weekNo(w)} <span class="dt-nav-pos">${DT.week + 1} / ${weeks.length}</span></span>
        <span class="dt-nav-range">${esc(cap(weekRange(w)))}</span>
      </div>
      <button type="button" class="dt-nav-btn" data-dt-step="1" aria-label="Semaine suivante"${next ? "" : " disabled"}>›</button>
      ${weeks.length > 1 ? `<select class="dt-select" data-dt-select aria-label="Choisir une semaine">${options}</select>` : ""}
      ${peak}
    </div>`;
  }

  function dtModesHtml() {
    const tab = (id, label) => {
      const on = DT.mode === id;
      return `<button type="button" class="dt-mode${on ? " active" : ""}" role="tab" aria-selected="${on}" data-dt-mode="${id}">${label}</button>`;
    };
    return `<div class="dt-modes" role="tablist" aria-label="Critère de classement">
      ${tab("engagement", "Engagement hors likes")}${tab("likes", "Likes")}
    </div>`;
  }

  function renderDailyTop() {
    const host = document.getElementById("dt-body");
    if (!host || !DT.data) return;
    const w = DT.data.weeks[DT.week];
    const inWeek = weekDates(w).map((d) => DT.byDay[d]).filter(Boolean);
    if (!inWeek.some((d) => d.d === DT.currentDay)) DT.currentDay = inWeek.length ? inWeek[0].d : null;
    host.dataset.mode = DT.mode;
    host.innerHTML = `
      ${dtTimelineHtml()}
      <div class="dt-sticky">
        <div class="dt-toolbar">${dtModesHtml()}${dtNavHtml("top")}</div>
        ${dtStripHtml(w, DT.mode)}
      </div>
      <p class="hint dt-mode-hint">${esc(DT_MODES[DT.mode].hint)}</p>
      <div class="dt-days" id="dt-days">${inWeek.map((d) => dtDayHtml(d, DT.mode)).join("")}</div>
      ${DT.data.weeks.length > 1 ? dtNavHtml("bottom") : ""}`;
    dtObserveDays();
  }

  function dtMarkCurrent(day) {
    DT.currentDay = day;
    document.querySelectorAll("#dt-body .dt-tile[data-dt-day]").forEach((t) => {
      t.classList.toggle("is-current", t.dataset.dtDay === day);
    });
  }

  function dtObserveDays() {
    if (DT.spy) DT.spy.disconnect();
    if (!("IntersectionObserver" in window)) return;
    DT.spy = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).map((e) => e.target.dataset.day);
      if (seen.length) dtMarkCurrent(seen.sort()[0]);
    }, { rootMargin: "-170px 0px -55% 0px" });
    document.querySelectorAll("#dt-days .dt-day").forEach((el) => DT.spy.observe(el));
  }

  function dtWriteHash(day) {
    if (!DT.data) return;
    const params = new URLSearchParams();
    if (day) params.set("jour", day);
    else params.set("semaine", DT.data.weeks[DT.week].id);
    if (DT.mode === "likes") params.set("tri", "likes");
    history.replaceState(null, "", `#${params.toString()}`);
  }

  const dtScrolledIn = () => {
    const sec = document.getElementById("daily-top");
    return !!sec && sec.getBoundingClientRect().top < 0;
  };

  function dtScrollToDay(day, smooth) {
    const el = document.getElementById(`dt-day-${day}`);
    if (!el) return;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
  }

  function dtSetWeek(idx) {
    const n = DT.data.weeks.length;
    const next = Math.max(0, Math.min(n - 1, idx));
    if (next === DT.week) return;
    const wasIn = dtScrolledIn();
    DT.week = next;
    DT.currentDay = null;
    renderDailyTop();
    dtWriteHash(null);
    if (wasIn) document.getElementById("dt-body").scrollIntoView({ block: "start" });
  }

  function dtGoTo(day, smooth = true) {
    if (!DT.data) {
      DT.pending = day;
      const sec = document.getElementById("daily-top");
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const wi = DT.weekOfDay[day];
    if (wi == null) return;
    if (wi !== DT.week || !document.getElementById(`dt-day-${day}`)) {
      DT.week = wi;
      DT.currentDay = day;
      renderDailyTop();
    }
    dtMarkCurrent(day);
    dtScrollToDay(day, smooth);
    dtWriteHash(day);
  }

  function bindDailyTop() {
    const section = document.getElementById("daily-top");
    if (!section) return;
    section.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-dt-mode],[data-dt-step],[data-dt-week],[data-dt-day]");
      if (!t || !DT.data) return;
      if (t.dataset.dtMode) {
        if (t.dataset.dtMode === DT.mode) return;
        const keep = dtScrolledIn() ? DT.currentDay : null;
        DT.mode = t.dataset.dtMode;
        renderDailyTop();
        if (keep) dtScrollToDay(keep, false);
        dtWriteHash(keep);
      } else if (t.dataset.dtStep) {
        dtSetWeek(DT.week + Number(t.dataset.dtStep));
      } else if (t.dataset.dtWeek != null) {
        dtSetWeek(Number(t.dataset.dtWeek));
      } else if (t.dataset.dtDay) {
        dtGoTo(t.dataset.dtDay);
      }
    });
    section.addEventListener("change", (ev) => {
      if (ev.target.matches("[data-dt-select]")) dtSetWeek(Number(ev.target.value));
    });
  }

  function bindDayClick(el) {
    if (!el || typeof el.on !== "function") return;
    el.on("plotly_click", (ev) => {
      const x = ev && ev.points && ev.points[0] && ev.points[0].x;
      if (x) dtGoTo(String(x).slice(0, 10));
    });
  }

  function applyDailyTop(data) {
    const host = document.getElementById("dt-body");
    if (!host || !data) return;
    DT.data = data;
    DT.byDay = Object.fromEntries((data.days || []).map((d) => [d.d, d]));
    DT.comm = Object.fromEntries((PHASE.nodes || []).map((n) => [cidOf(n), n]));
    DT.weekOfDay = {};
    (data.weeks || []).forEach((w, i) => weekDates(w).forEach((d) => { DT.weekOfDay[d] = i; }));
    const vols = (data.weeks || []).map(weekVolume);
    DT.peakWeek = vols.length ? vols.indexOf(Math.max(...vols)) : 0;
    const meta = document.getElementById("dt-meta");
    if (meta) {
      const st = data.stats || {};
      meta.textContent = `${fmt(st.nDays)} jours du ${shortDate(st.firstDay)} au ${shortDate(st.lastDay)} · ${fmt((data.weeks || []).length)} semaine${(data.weeks || []).length > 1 ? "s" : ""} · ${fmt(st.pool)} publications hors RT classées`;
    }
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.get("tri") === "likes") DT.mode = "likes";
    const hashDay = params.get("jour");
    const hashWeek = (data.weeks || []).findIndex((w) => w.id === params.get("semaine"));
    const target = DT.pending || (DT.weekOfDay[hashDay] != null ? hashDay : null);
    if (hashWeek >= 0) DT.week = hashWeek;
    renderDailyTop();
    if (target) dtGoTo(target, !!DT.pending);
    else if (hashWeek >= 0 || location.hash === "#daily-top") document.getElementById("daily-top").scrollIntoView({ block: "start" });
    DT.pending = null;
  }

  async function initDailyTop(preloaded) {
    const host = document.getElementById("dt-body");
    if (!host) return;
    bindDailyTop();
    try {
      let data = preloaded;
      if (!data) {
        const r = await fetch(`./${encodeURIComponent(CORPUS)}_daily_top.json`);
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        data = await r.json();
      }
      applyDailyTop(data);
    } catch (err) {
      host.innerHTML = `<p class="err">Top publications par jour indisponible — ${esc(err)}.</p>`;
    }
  }

  function dailyTopSectionHtml() {
    return `
      <section class="daily-top" id="daily-top" aria-labelledby="dt-title">
        <div class="dt-header">
          <h2 id="dt-title">Top 5 publications par jour</h2>
          <p class="dt-meta" id="dt-meta"></p>
        </div>
        <div class="howto-box">
          <strong>Comment lire ce bloc</strong>
          <ol>
            <li>Chaque jour du corpus, les <strong>5 publications</strong> les plus engageantes, avec leur <strong>texte intégral</strong>, leur auteur, leur type (tweet original, réponse, citation) et le pôle Louvain de l’auteur.</li>
            <li>Onglet <strong>Engagement hors likes</strong> : retweets + réponses + citations reçus. Onglet <strong>Likes</strong> : likes reçus uniquement. Le total du bandeau et la part de chaque publication portent sur <strong>toutes</strong> les publications hors RT du jour.</li>
            <li>Les jours sont présentés <strong>semaine par semaine</strong> (lundi → dimanche, jours UTC comme la courbe de volume) : flèches, liste des semaines ou frise hebdomadaire ; la bande des 7 jours mène directement à un jour.</li>
            <li>Les retweets sont exclus du classement : ils reprennent les compteurs du tweet d’origine et un texte tronqué. Compteurs plateforme relevés à la collecte.</li>
          </ol>
        </div>
        <div class="dt-body" id="dt-body"><p class="hint">Chargement des publications…</p></div>
      </section>`;
  }

  function tick() {
    return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  }

  function fetchJsonQuiet(path) {
    return fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    });
  }

  async function main() {
    const root = document.getElementById("app");
    if (!CORPUS) {
      root.innerHTML = "<p class='err'>Corpus manquant.</p>";
      return;
    }
    try {
      root.innerHTML = "<p class='hint'>Téléchargement des analyses…</p>";
      // Prefetch heavy secondary payloads while the main pack downloads.
      const profilesP = fetchJsonQuiet(`./${encodeURIComponent(CORPUS)}_profiles.json`).catch(() => null);
      const dailyP = fetchJsonQuiet(`./${encodeURIComponent(CORPUS)}_daily_top.json`).catch(() => null);
      const pack = await fetchJsonQuiet(`./${encodeURIComponent(CORPUS)}.json`);
      document.title = `Flux intercommunautaires — ${pack.corpus?.label || CORPUS}`;
      PHASE = pack.phase;
      root.innerHTML = pageHtml(pack);
      const ph = pack.phase;
      const gd = ph.globalDistributions || {};

      // Light charts first (shell already visible).
      plotDonut(document.getElementById("donut-pub"), gd.publications, "Volume de publication");
      plotDonut(document.getElementById("donut-in"), gd.inStrength, "In-strength");
      await tick();
      plotDonut(document.getElementById("donut-out"), gd.outStrength, "Out-strength");
      plotDonut(document.getElementById("donut-rt"), gd.rtReceived, "RT reçus");
      await tick();
      ((ph.communityTreemaps || {}).metrics || []).forEach((m) => {
        plotCommunityTreemap(document.getElementById(`treemap-${m.id}`), m);
      });
      plotVolume(document.getElementById("volume"), ph.volumeDaily);
      await tick();
      plotActivity(document.getElementById("activity"), ph.dailyActivity, "stack");
      bindActivityTabs(ph.dailyActivity);
      await tick();
      plotEngagement(document.getElementById("eng"), ph);
      plotLikes(document.getElementById("likes"), ph);
      plotConcentration(document.getElementById("conc"), ph);
      await tick();
      renderSankey(document.getElementById("sankey"), ph);
      renderCircular(document.getElementById("circ"), ph);
      renderAccounts();
      document.querySelectorAll("#metric-tabs .metric-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeMetric = btn.dataset.metric;
          renderAccounts();
        });
      });

      // Section loaders already in HTML; hydrate when prefetch resolves.
      const [profiles, daily] = await Promise.all([profilesP, dailyP]);
      initProfiles(profiles || undefined);
      initDailyTop(daily || undefined);
    } catch (err) {
      root.innerHTML = `<p class="err">Chargement impossible — ${esc(err)}. Servir le dossier via HTTP.</p>`;
    }
  }

  main();
})();
