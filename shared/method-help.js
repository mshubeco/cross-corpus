/**
 * Fenêtre méthodologique « ? » — standards scientifiques, rédaction accessible.
 * Usage (module) :
 *   import { initMethodHelp } from '../shared/method-help.js';
 *   initMethodHelp({ getTopic: () => 'connectome_all' });
 *   // ou topic fixe : initMethodHelp({ topic: 'flux' });
 */

const TOPICS = {
  connectome_all: {
    kicker: 'Connectome · mode graphe',
    title: 'Toutes interactions — comment lire ce visual',
    html: `
      <h3>Objet</h3>
      <p>Réseau d’<strong>interactions sociales</strong> entre comptes X/Twitter sur un corpus thématique.
      Chaque nœud est un compte ; chaque lien résume les échanges observés dans la fenêtre de collecte.</p>

      <h3>Définition des arêtes</h3>
      <p>Une arête relie deux comptes s’il existe au moins une interaction parmi&nbsp;:</p>
      <ul>
        <li><strong>Retweet</strong> (RT) — amplification d’un message</li>
        <li><strong>Réponse</strong> (reply)</li>
        <li><strong>Citation</strong> (quote)</li>
        <li><strong>Mention</strong></li>
      </ul>
      <p>Le poids de l’arête est le <strong>nombre d’interactions</strong> agrégées (seuil de layout typique&nbsp;: poids ≥&nbsp;1).</p>

      <h3>Communautés (couleurs)</h3>
      <p>Partition <strong>Louvain</strong> sur le graphe toutes-interactions (modularité maximisée).
      Les couleurs du panneau «&nbsp;Communautés&nbsp;» couvrent ~90&nbsp;% des nœuds (<em>communities90</em>) ;
      le hub affiché est le membre de plus fort degré pondéré.</p>
      <div class="mh-cite">Blondel, V. D., Guillaume, J.-L., Lambiotte, R., &amp; Lefebvre, E. (2008).
        Fast unfolding of communities in large networks. <em>J. Stat. Mech.</em></div>

      <h3>Disposition spatiale</h3>
      <p>Layout <strong>ForceAtlas2</strong> (Gephi / FA2) précalculé&nbsp;: attraction des liés, répulsion des non-liés.
      La vue 3D extrude légèrement les brins pour la lisibilité ; la topologie reste celle du FA2 2D.</p>
      <div class="mh-cite">Jacomy, M., Venturini, T., Heymann, S., &amp; Bastian, M. (2014).
        ForceAtlas2, a continuous graph layout algorithm for handy network visualization.
        <em>PLOS ONE</em>.</div>

      <h3>Métriques du panneau</h3>
      <table class="mh-params">
        <tr><th>Taille / %</th><td>Nombre de comptes dans la communauté Louvain et part du graphe.</td></tr>
        <tr><th>Hub</th><td>Compte au plus fort degré pondéré (in + out) dans la communauté.</td></tr>
        <tr><th>Publications</th><td>Volume de pubs associées (hors RT quand disponible).</td></tr>
      </table>

      <h3>Distinction RT / interactions (HUD)</h3>
      <p>Option de <strong>coloration des liens</strong> (pas un autre graphe)&nbsp;: chaque arête du graphe toutes-interactions
      est classée selon la part de RT dans son poids&nbsp;:</p>
      <table class="mh-params">
        <tr><th>Interactions</th><td>part RT ≤ 30&nbsp;%</td></tr>
        <tr><th>Mixtes</th><td>30–70&nbsp;% RT</td></tr>
        <tr><th>RT</th><td>part RT ≥ 70&nbsp;%</td></tr>
      </table>

      <div class="mh-caveat"><strong>Limites.</strong> Une communauté Louvain n’est pas une appartenance partisane.
        Les labels opérationnels du panneau discursif sont des <em>qualifications de pôles</em> (lexique distinctif), pas des étiquettes individuelles.</div>
    `,
  },

  connectome_rt: {
    kicker: 'Connectome · mode graphe',
    title: 'RT — comment lire ce visual',
    html: `
      <h3>Objet</h3>
      <p>Sous-graphe restreint aux <strong>retweets</strong>&nbsp;: qui amplifie qui, sans replies / quotes / mentions.</p>

      <h3>Définition des arêtes</h3>
      <p>Arête <em>A → B</em> (ou non orientée selon l’export)&nbsp;: A a retweeté un message associé à B
      (souvent&nbsp;: RT vers la première mention / auteur du tweet parent).
      Poids = nombre de RT agrégés sur la fenêtre du corpus.</p>

      <h3>Communautés &amp; layout</h3>
      <p>Même logique que «&nbsp;Toutes interactions&nbsp;»&nbsp;: <strong>Louvain</strong> + layout <strong>ForceAtlas2</strong>,
      mais calculés sur le graphe RT seul — les pôles peuvent donc différer du graphe complet.</p>

      <h3>À quoi ça sert</h3>
      <ul>
        <li>Repérer les <strong>circuits d’amplification</strong> (hubs RT, chaînes).</li>
        <li>Comparer avec le mode toutes-interactions pour voir ce que le RT structure vs le débat (reply/quote).</li>
      </ul>

      <div class="mh-caveat"><strong>Limites.</strong> Un RT n’implique pas un accord idéologique.
        Les comptes très suivis concentrent mécaniquement les RT (effet de popularité).</div>
    `,
  },

  connectome_hash: {
    kicker: 'Connectome · mode #',
    title: 'Hashtags distinctifs — méthode & filtre',
    html: `
      <h3>Objet</h3>
      <p>Repérer les <strong>hashtags qui caractérisent</strong> un pôle (communauté Louvain) par rapport au reste du graphe,
      puis <strong>surligner</strong> les comptes du graphe qui les ont réellement utilisés.</p>

      <h3>Keyness (score z)</h3>
      <p>Pour chaque communauté, on compare la fréquence d’un hashtag <em>dans</em> le pôle à sa fréquence <em>hors</em> pôle
      via un <strong>log-odds pondéré</strong> (prior de Dirichlet calé sur le fond lexical), puis un score
      <strong>z = δ / σ</strong> (Monroe, Colaresi &amp; Quinn 2008). Seuls les tags à z élevé (et n minimal) sont retenus.</p>
      <div class="mh-formula">z = δ / σ &nbsp;·&nbsp; δ = log-odds pondéré (pôle vs reste)</div>
      <div class="mh-cite">Monroe, B. L., Colaresi, M. P., &amp; Quinn, K. M. (2008).
        Fightin’ words: Lexical feature selection and evaluation for identifying the content of political conflict.
        <em>Political Analysis</em>, 16(4), 372–403.</div>

      <h3>Effectif «&nbsp;comptes&nbsp;»</h3>
      <p>Nombre de <strong>comptes présents dans le graphe</strong> ayant publié au moins un message <strong>hors retweet</strong>
      (original, reply, quote) contenant le hashtag (champ <code>hashtag</code> + détection <code>#…</code> dans le texte).</p>
      <p>Ce n’est <em>pas</em> le nombre de tweets, ni tous les auteurs du CSV hors graphe.</p>

      <h3>Filtre d’affichage</h3>
      <ul>
        <li><strong>Nœuds</strong> — ambre pour les comptes matchés ; le reste est assombri.</li>
        <li><strong>Liens</strong> — fort si les <em>deux</em> extrémités matchent ; halo faible si une seule.</li>
        <li>Disponible uniquement lorsque les couleurs des liens sont en mode <strong>Communautés</strong> (pas Distinction RT).</li>
      </ul>

      <div class="mh-caveat"><strong>Limites.</strong> Un hashtag «&nbsp;distinctif&nbsp;» décrit le <em>lexique relatif</em> d’un pôle,
        pas une vérité factuelle. Le surlignage suit les usages documentés dans le CSV, pas l’intention des auteurs.</div>
    `,
  },

  flux: {
    kicker: 'Flux continu',
    title: 'Réseau dynamique — fenêtre glissante 3 jours',
    html: `
      <h3>Objet</h3>
      <p>Animation du réseau d’interactions au fil du temps&nbsp;: qui entre / sort du débat, comment les pôles se déplacent.
      Aligné sur les critères HEAT «&nbsp;flux continu&nbsp;».</p>

      <h3>Construction des frames</h3>
      <table class="mh-params">
        <tr><th>Fenêtre</th><td>Glissante de <strong>3 jours</strong> (UTC).</td></tr>
        <tr><th>Interactions</th><td>RT + reply + quote + mention.</td></tr>
        <tr><th>Seuil d’arête</th><td><code>min_edge_weight = 2</code> (au moins 2 interactions dans la fenêtre).</td></tr>
        <tr><th>Layout</th><td><strong>ForceAtlas2</strong> recalculé <em>par frame</em>, puis aligné par <strong>Procrustes</strong> pour stabiliser la caméra.</td></tr>
      </table>

      <h3>Entrées / sorties</h3>
      <p>Un compte «&nbsp;entre&nbsp;» lorsqu’il apparaît avec des arêtes dans la fenêtre courante ;
      il «&nbsp;sort&nbsp;» lorsqu’il disparaît. Le fondu E/S est un lissage visuel (pas une métrique causale).</p>

      <h3>Couleurs</h3>
      <ul>
        <li><strong>Louvain global ALL</strong> — partition du connectome toutes-interactions (couleur stable dans le temps).</li>
        <li><strong>Track · fenêtre 3j</strong> — communautés locales suivies par similarité Jaccard (≥&nbsp;0,3) d’une frame à l’autre.</li>
        <li><strong>Classes ternaires RT</strong> — coloration des <em>liens</em> selon la part RT (comme sur le connectome).</li>
      </ul>

      <h3>Volume (barre basse)</h3>
      <p>Histogramme des <strong>publications / jour</strong> du corpus (source analyses intercomm), indépendant du graphe affiché.
      Le curseur synchronise le jour de la fenêtre.</p>

      <div class="mh-caveat"><strong>Limites.</strong> Une fenêtre de 3 jours lisse les pics courts et peut fragmenter les communautés locales.
        Le layout FA2 par frame n’est pas une trajectoire physique des acteurs — seulement une visualisation cohérente.</div>
    `,
  },

  coordination: {
    kicker: 'Réseau de coordination',
    title: 'Backbone co-RT · filtre de disparité Serrano',
    html: `
      <h3>Objet</h3>
      <p>Sous-réseau des comptes qui <strong>retweetent les mêmes parents</strong> (co-retweet),
      réduit à un <strong>backbone</strong> statistiquement saillant — lecture de <em>coordination d’amplification</em>,
      <strong>pas</strong> une preuve d’inauthenticité.</p>

      <h3>Couche co-RT</h3>
      <p>Poids <em>w<sub>uv</sub></em> = nombre de tweets parents distincts retweetés en commun par u et v.
      Filtres préalables&nbsp;: au moins <strong>2</strong> co-RT ; parents trop viraux exclus (cap ≤&nbsp;80 RTers, aligné MCA).</p>

      <h3>Filtre de disparité (Serrano et al. 2009)</h3>
      <p>Pour chaque nœud i de force s<sub>i</sub> et degré k<sub>i</sub>, la significativité d’une arête de poids w<sub>ij</sub> est&nbsp;:</p>
      <div class="mh-formula">p<sub>ij</sub><sup>(i)</sup> = (1 − w<sub>ij</sub>/s<sub>i</sub>)<sup>k<sub>i</sub>−1</sup>
        &nbsp;·&nbsp; garder si p<sub>u</sub> &lt; α <strong>OU</strong> p<sub>v</sub> &lt; α</div>
      <table class="mh-params">
        <tr><th>α</th><td>0,05</td></tr>
        <tr><th>Règle</th><td>OR (asymétrique&nbsp;: une extrémité suffit)</td></tr>
      </table>
      <div class="mh-cite">Serrano, M. Á., Boguñá, M., &amp; Vespignani, A. (2009).
        Extracting the multiscale backbone of complex weighted networks.
        <em>PNAS</em>, 106(16), 6483–6488.</div>

      <h3>Communautés &amp; couleurs</h3>
      <ul>
        <li><strong>Coordination</strong> — Louvain sur le backbone Serrano.</li>
        <li><strong>Connectome</strong> — projection des couleurs Louvain du graphe d’origine (par screen_name).</li>
      </ul>

      <h3>Labels &amp; taille</h3>
      <p>Taille des labels ∝ <strong>PageRank</strong> pondéré (α=0,85, poids = co-RT Serrano) sur le backbone.
        Révélation progressive au zoom (mêmes standards que le connectome).</p>

      <h3>Vue 3D — comment lire la profondeur (axe Z)</h3>
      <p>Le plan du graphe reste «&nbsp;qui est lié à qui&nbsp;». La <strong>profondeur</strong> (3ᵉ axe) encode la
        <em>synchronicité</em> des co-RT&nbsp;; tournez la vue pour la sentir. Lecture en <em>profondeur faible → forte</em>&nbsp;:</p>
      <ul>
        <li><strong>Profondeur faible</strong> — co-RT plus décalés (mêmes contenus, pas au même moment).</li>
        <li><strong>Profondeur forte</strong> — co-RT très synchrones (mêmes contenus, presque en même temps).</li>
      </ul>
      <div class="mh-formula">Z ∝ −médiane(Δt) entre les RT du même parent par les deux comptes</div>
      <p>Ce n’est <strong>pas</strong> une date du calendrier, ni une distance géographique, ni une importance —
        seulement un chronomètre d’écart entre retweets partagés.</p>

      <h3>Panel discursif</h3>
      <p>Hashtags / termes distinctifs (keyness G² ou z) sur publications <strong>hors RT</strong> des comptes du backbone,
        par cluster de coordination.</p>

      <div class="mh-caveat"><strong>Limites &amp; vocabulaire.</strong> «&nbsp;Coordination&nbsp;» désigne une structure d’amplification partagée.
        Cela n’établit ni intention concertée, ni inauthenticité, ni affiliation partisane des comptes ordinaires.</div>
    `,
  },
};

const CONNECTOME_TABS = [
  { id: 'connectome_all', label: 'Toutes interactions' },
  { id: 'connectome_rt', label: 'RT' },
  { id: 'connectome_hash', label: '#' },
];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function ensureCss(href) {
  const id = 'mh-css';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * @param {{ topic?: string, getTopic?: () => string, buttonParent?: HTMLElement, cssHref?: string, showConnectomeTabs?: boolean }} opts
 */
export function initMethodHelp(opts = {}) {
  const cssHref = opts.cssHref || new URL('./method-help.css', import.meta.url).href;
  ensureCss(cssHref);

  const getTopic = () => {
    if (typeof opts.getTopic === 'function') return opts.getTopic();
    return opts.topic || 'connectome_all';
  };

  let currentTopic = getTopic();
  const showTabs = opts.showConnectomeTabs === true
    || (typeof currentTopic === 'string' && currentTopic.startsWith('connectome_'));

  const overlay = el('div', {
    className: 'mh-overlay',
    id: 'methodHelpOverlay',
    role: 'presentation',
  });
  const dialog = el('div', {
    className: 'mh-dialog',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'mhTitle',
  });
  const kicker = el('div', { className: 'mh-kicker', id: 'mhKicker' });
  const title = el('h2', { className: 'mh-title', id: 'mhTitle' });
  const closeBtn = el('button', {
    className: 'mh-close',
    type: 'button',
    'aria-label': 'Fermer',
    text: '×',
  });
  const head = el('div', { className: 'mh-head' }, [
    el('div', {}, [kicker, title]),
    closeBtn,
  ]);
  const tabsWrap = el('div', { className: 'mh-tabs' });
  if (!showTabs) tabsWrap.hidden = true;
  const body = el('div', { className: 'mh-body', id: 'mhBody' });

  dialog.append(head, tabsWrap, body);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const tabBtns = [];
  if (showTabs) {
    for (const t of CONNECTOME_TABS) {
      const b = el('button', {
        className: 'mh-tab',
        type: 'button',
        'data-topic': t.id,
        text: t.label,
      });
      b.addEventListener('click', () => renderTopic(t.id));
      tabsWrap.appendChild(b);
      tabBtns.push(b);
    }
  }

  function renderTopic(id) {
    const topic = TOPICS[id] || TOPICS.connectome_all;
    currentTopic = id;
    kicker.textContent = topic.kicker;
    title.textContent = topic.title;
    body.innerHTML = topic.html;
    for (const b of tabBtns) {
      b.classList.toggle('active', b.getAttribute('data-topic') === id);
    }
  }

  function open() {
    const id = getTopic();
    renderTopic(TOPICS[id] ? id : 'connectome_all');
    overlay.classList.add('open');
    helpBtn.setAttribute('aria-expanded', 'true');
    closeBtn.focus();
  }
  function close() {
    overlay.classList.remove('open');
    helpBtn.setAttribute('aria-expanded', 'false');
    helpBtn.focus();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  const helpBtn = el('button', {
    className: 'mh-btn',
    type: 'button',
    id: 'methodHelpBtn',
    title: 'Méthode & lecture des métriques',
    'aria-label': 'Aide méthodologique',
    'aria-expanded': 'false',
    'aria-controls': 'methodHelpOverlay',
    text: '?',
  });
  helpBtn.addEventListener('click', () => {
    if (overlay.classList.contains('open')) close();
    else open();
  });

  const parent = opts.buttonParent
    || document.getElementById('navTools')
    || document.getElementById('corpusNav')
    || document.getElementById('hud')
    || document.body;
  parent.appendChild(helpBtn);

  return { open, close, renderTopic, button: helpBtn };
}

export { TOPICS };
