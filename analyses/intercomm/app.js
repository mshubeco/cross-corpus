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

  function plotSankey(el, sankey) {
    if (!el || !sankey?.nodes?.length) return;
    const nodes = sankey.nodes;
    const idx = Object.fromEntries(nodes.map((n, i) => [n.id, i]));
    const links = (sankey.links || []).filter((l) => idx[l.from] != null && idx[l.to] != null);
    Plotly.newPlot(el, [{
      type: "sankey", arrangement: "snap",
      node: {
        label: nodes.map((n) => `@${n.hub || n.id}`),
        color: nodes.map((n) => n.color),
        pad: 14, thickness: 16,
      },
      link: {
        source: links.map((l) => idx[l.from]),
        target: links.map((l) => idx[l.to]),
        value: links.map((l) => l.weight),
        color: links.map((l) => l.internal ? "rgba(154,163,181,0.28)" : "rgba(77,138,240,0.38)"),
      },
    }], plotlyLayout({ margin: { t: 12, b: 12, l: 12, r: 12 }, height: 440 }),
    { responsive: true, displayModeBar: false });
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

  function rankingsHtml(ph) {
    const ranks = ph.communityRankings || {};
    return Object.values(ranks).map((r) => {
      const rows = (r.accounts || []).map((a) =>
        `<div class="acct-row"><span><a class="handle" href="${xUrl(a.screen_name)}" target="_blank" rel="noopener">@${esc(a.screen_name)}</a></span><span>${fmt(a.inStrength)} <span style="color:var(--muted)">(${esc(a.pct)}%)</span></span></div>`
      ).join("");
      return `<div class="viz-box comm-acct">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:600">
          <span class="dot" style="background:${esc(r.color)}"></span>C${esc(r.communityId)} · @${esc(r.hub)}
        </div>${rows || "<p class='hint'>—</p>"}</div>`;
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
          <li><strong>Sankey</strong> — matrice complète intra + inter des pôles affichés.</li>
          <li><strong>Heatmaps</strong> — parts sortantes (somme ligne = 100 %) et entrantes (somme colonne = 100 %) sur le top 5.</li>
          <li><strong>Top comptes</strong> — in-strength (interactions reçues) au sein de chaque communauté.</li>
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
            <div class="viz-title">Sankey · intra + inter</div>
            <p class="hint">Total ${fmt((ph.sankey || {}).total)} · interne ${(ph.sankey || {}).internalPct ?? "—"} %</p>
            <div id="sankey" style="min-height:440px"></div>
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
      <h2>Top comptes par communauté</h2>
      <p class="hint">Classement par interactions entrantes (in-strength) · lien vers le profil X</p>
      <div class="comm-grid">${rankingsHtml(ph)}</div>
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
      plotSankey(document.getElementById("sankey"), ph.sankey);
      renderCircular(document.getElementById("circ"), ph);
    } catch (err) {
      root.innerHTML = `<p class="err">Chargement impossible — ${esc(err)}. Servir le dossier via HTTP.</p>`;
    }
  }

  main();
})();
