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

      <h3>Centralité (taille des nœuds)</h3>
      <p>Sous-choix sous les onglets graphe&nbsp;: <strong>Degré In</strong>, <strong>Degré Out</strong>,
      <strong>Degré pondéré</strong> (somme des poids incidents), <strong>PageRank</strong> (dirigé, d=0,85),
      <strong>Eigenvector</strong> (graphe non orienté pondéré). Les positions FA2 restent identiques&nbsp;;
      seuls la taille des points et des labels changent. Compatible avec <strong>#</strong> et <strong>Lemme</strong>.</p>

      <h3>Métriques du panneau</h3>
      <table class="mh-params">
        <tr><th>Taille / %</th><td>Nombre de comptes dans la communauté Louvain et part du graphe.</td></tr>
        <tr><th>Hub</th><td>Compte au plus fort degré pondéré (in + out) dans la communauté.</td></tr>
        <tr><th>Publications</th><td>Volume de pubs associées (hors RT quand disponible).</td></tr>
      </table>

      <h3>Distinction RT / interactions (HUD)</h3>
      <p><strong>Toujours sur l’onglet «&nbsp;Toutes interactions&nbsp;»</strong> — ce n’est <em>pas</em> le graphe RT
      (onglet séparé «&nbsp;RT&nbsp;»). C’est une option de <strong>coloration des liens</strong> du même réseau
      toutes-interactions&nbsp;: chaque arête est classée selon la part de RT dans son poids&nbsp;:</p>
      <table class="mh-params">
        <tr><th>Interactions</th><td>part RT ≤ 30&nbsp;%</td></tr>
        <tr><th>Mixtes</th><td>30–70&nbsp;% RT</td></tr>
        <tr><th>RT</th><td>part RT ≥ 70&nbsp;%</td></tr>
      </table>
      <p>Topologie, nœuds et communautés restent ceux du mode Toutes interactions&nbsp;;
      seul le rendu des arêtes change.</p>

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

      <h3>Centralité (taille des nœuds)</h3>
      <p>Même sous-menu que sur Toutes interactions (In / Out / pondéré / PageRank / Eigenvector),
      recalculé sur le sous-graphe RT. La spatialisation FA2 RT ne change pas.</p>

      <h3>À quoi ça sert</h3>
      <ul>
        <li>Repérer les <strong>circuits d’amplification</strong> (hubs RT, chaînes).</li>
        <li>Comparer avec le mode toutes-interactions pour voir ce que le RT structure vs le débat (reply/quote).</li>
      </ul>

      <p>Ne pas confondre avec «&nbsp;Distinction RT / interactions&nbsp;» dans le HUD&nbsp;:
      celle-ci colore les liens du graphe <strong>Toutes interactions</strong> selon la part RT —
      ce n’est pas ce sous-graphe RT.</p>

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
        <li><strong>Générateurs</strong> — comptes ayant publié le # ; liens <em>uniquement entre</em> ces comptes.</li>
        <li><strong>Générateurs + cibles</strong> — idem + voisins d’interaction (ambre) ; liens touchant ≥1 générateur (fort / halo).</li>
        <li>Disponible uniquement lorsque les couleurs des liens sont en mode <strong>Communautés</strong> (pas Distinction RT).</li>
      </ul>

      <div class="mh-caveat"><strong>Limites.</strong> Un hashtag «&nbsp;distinctif&nbsp;» décrit le <em>lexique relatif</em> d’un pôle,
        pas une vérité factuelle. Le surlignage suit les usages documentés dans le CSV, pas l’intention des auteurs.</div>
    `,
  },

  connectome_lemma: {
    kicker: 'Connectome · mode Lemme',
    title: 'Lemmes distinctifs — méthode & filtre',
    html: `
      <h3>Objet</h3>
      <p>Même logique que le mode <strong>#</strong>, appliquée aux <strong>formes lexicales</strong> (tokens hors stop-words)
      qui caractérisent un pôle Louvain — pour visualiser où se positionnent les principaux lemmes du réseau.</p>

      <h3>Keyness (score z)</h3>
      <p>Fréquence du terme <em>dans</em> le pôle vs <em>hors</em> pôle : log-odds pondéré puis
      <strong>z = δ / σ</strong> (Monroe et al. 2008). Les profils intercomm ou un calcul CSV direct
      fournissent les listes <code>key_words</code> par communauté.</p>
      <div class="mh-formula">z = δ / σ &nbsp;·&nbsp; δ = log-odds pondéré (pôle vs reste)</div>

      <h3>Effectif «&nbsp;comptes&nbsp;»</h3>
      <p>Comptes du <strong>graphe</strong> ayant publié hors RT au moins un message contenant la forme
      (tokenisation simple, sans lemmatiseur morphologique complet).</p>

      <h3>Filtre d’affichage</h3>
      <ul>
        <li>Mêmes portées que le mode # : <strong>Générateurs</strong> vs <strong>Générateurs + cibles</strong>.</li>
        <li>Fiche bas-droite : co-occurrents (même message) + parts par communauté (couleurs Louvain).</li>
      </ul>

      <div class="mh-caveat"><strong>Limites.</strong> Ce sont des <em>formes graphiques</em> distinctives, pas forcément des lemmes
        morphologiques (ex. pluriels / conjugaisons peuvent rester séparés). Le score décrit un contraste relatif,
        pas une thématique certifiée.</div>
    `,
  },

  flux: {
    kicker: 'Flux continu',
    title: 'Réseau dynamique — deux temporalités',
    html: `
      <h3>Objet</h3>
      <p>Animation du réseau d’interactions au fil du temps&nbsp;: qui entre / sort du débat, comment les pôles se déplacent.
      Aligné sur les critères HEAT «&nbsp;flux continu&nbsp;».</p>

      <h3>Modes temporels (sélecteur «&nbsp;Temporalité&nbsp;»)</h3>
      <table class="mh-params">
        <tr><th>Fenêtre 3j (lissée)</th><td>Frame du jour <strong>D</strong> = interactions du <strong>D−2 au D</strong> (UTC).
          Un compte reste visible tant qu’il a une arête dans cette fenêtre — donc parfois 1–2 jours <em>après</em> sa dernière activité réelle.</td></tr>
        <tr><th>Journalier strict</th><td>Frame du jour <strong>D</strong> = interactions du <strong>seul jour D</strong>.
          Un compte n’apparaît que s’il est actif ce jour-là. Nécessite <code>manifest_daily.json</code> (pipeline <code>--window-days 1</code>).</td></tr>
      </table>

      <h3>Construction des frames</h3>
      <table class="mh-params">
        <tr><th>Interactions</th><td>RT + reply + quote + mention.</td></tr>
        <tr><th>Seuil d’arête</th><td><code>min_edge_weight = 2</code> en général (1 pour HMPV FR sparse).</td></tr>
        <tr><th>Layout</th><td><strong>ForceAtlas2</strong> recalculé <em>par frame</em>, puis aligné par <strong>Procrustes</strong>.</td></tr>
      </table>

      <h3>Entrées / sorties</h3>
      <p>Un compte «&nbsp;entre&nbsp;» lorsqu’il apparaît avec des arêtes dans la fenêtre (ou le jour) courant ;
      il «&nbsp;sort&nbsp;» lorsqu’il disparaît. En fenêtre 3j, un fondu visuel relie deux frames.
      En journalier strict, l’image reste sur le jour affiché, sans mélange avec le suivant.
      Le survol d’un nom de compte ouvre ses publications les plus engageantes, comme dans le connectome.</p>

      <h3>Couleurs</h3>
      <ul>
        <li><strong>Louvain global ALL</strong> — partition du connectome toutes-interactions.</li>
        <li><strong>Track · local</strong> — communautés locales (Jaccard ≥&nbsp;0,3) d’une frame à l’autre.</li>
        <li><strong>Distinction RT / interactions</strong> — couleur des <em>liens</em> selon la part RT.</li>
      </ul>

      <h3>Volume (barre basse)</h3>
      <p>Histogramme des <strong>publications / jour</strong> du corpus, indépendant du graphe.
      Le curseur synchronise le jour affiché.</p>

      <div class="mh-caveat"><strong>Limites.</strong> Le mode 3j lisse les pics courts. Le mode journalier est plus «&nbsp;fidèle&nbsp;» au calendrier mais plus saccadé.
        Le layout FA2 n’est pas une trajectoire physique des acteurs.</div>
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

  connectome_typo: {
    kicker: 'Connectome · typologie des comptes',
    title: 'Sur quelle littérature s’appuie le classement',
    html: `
      <h3>Ce que la couleur représente</h3>
      <p>Les modes <strong>Macro-classes d’utilisateurs</strong> et <strong>Type d’utilisateurs</strong> colorent la <strong>persona revendiquée</strong>&nbsp;:
      ce que le compte dit être, pas ce que ses messages racontent, ni s’il est authentique.
      Huit macro-classes, vingt catégories. En cas de plusieurs rôles, l’ordre est fixe&nbsp;:
      mandat public, puis organisation, profession, notoriété, engagement, citoyen.
      Un profil vide reste <strong>indéterminé</strong>, sauf si les publications propres du compte,
      dans ce corpus, montrent une pratique militante répétée.
      Un profil qui se dit militant, mais dont les messages ne portent pas cette pratique, est relu comme citoyen.
      Les autres rôles ne sont pas déduits des tweets.</p>
      <p>Le principe vient de la technique DISARM <strong>T0097 Present Persona</strong>&nbsp;:
      coder l’identité présentée, et tenir à part l’authenticité, l’automatisation et le lien avec un État.</p>
      <div class="mh-cite">DISARM Foundation. Technique T0097, Present Persona.
        <a href="https://github.com/DISARMFoundation/DISARMframeworks/blob/main/generated_pages/techniques/T0097.md" target="_blank" rel="noopener noreferrer">DISARMframeworks</a>.</div>

      <h3>Le socle : Lotan et al. (2011)</h3>
      <p>La liste de référence pour les acteurs d’un réseau Twitter est celle de
      <strong>Lotan, Graeff, Ananny, Gaffney, Pearce et boyd (2011)</strong>,
      établie sur les révolutions tunisienne et égyptienne.
      Elle distingue, dans une seule dimension, médias traditionnels, médias nés en ligne,
      organisations non médiatiques, journalistes, blogueurs, militants, digerati,
      acteurs politiques, célébrités, chercheurs, bots et autres.</p>
      <p>La grille de 2026 reprend ces rôles et les sépare quand Lotan les mélangeait.
      Chaque code se reconvertit vers <strong>une seule</strong> catégorie de 2011,
      pour rester comparable à la littérature 2011-2020.
      Les blogueurs n’ont plus de case propre&nbsp;: ils se répartissent selon le rôle actuel
      (média alternatif, créateur, expert). Les bots ne sont plus une identité&nbsp;:
      l’automatisation est une autre question (Gorwa et Guilbeault 2020).</p>
      <div class="mh-cite">Lotan, G., Graeff, E., Ananny, M., Gaffney, D., Pearce, I., &amp; boyd, d. (2011).
        The revolutions were tweeted: Information flows during the 2011 Tunisian and Egyptian revolutions.
        <em>International Journal of Communication</em>, 5, 1375–1405.
        <a href="https://ijoc.org/index.php/ijoc/article/view/1246" target="_blank" rel="noopener noreferrer">ijoc.org</a>.</div>
      <div class="mh-cite">Gorwa, R., &amp; Guilbeault, D. (2020). Unpacking the social media bot: A typology to guide research and policy.
        <em>Policy &amp; Internet</em>, 12(2), 225–248.
        <a href="https://doi.org/10.1002/poi3.184" target="_blank" rel="noopener noreferrer">doi:10.1002/poi3.184</a>.</div>

      <h3>Ce que chaque famille emprunte</h3>
      <table class="mh-params">
        <tr><th>Médias historiques, pure players, journalistes, élus et partis, chercheurs, célébrités, militants</th>
          <td>Lotan et al. 2011. Le compte d’une rédaction et le compte personnel d’un journaliste ne reçoivent pas le même code.</td></tr>
        <tr><th>Média alternatif</th>
          <td>Holt, Figenschou et Frischlich (2019)&nbsp;: un média alternatif se définit par sa position face aux médias dominants, pas par une idéologie. Cointet et al. (2021) décrivent cet espace dans l’écosystème médiatique français.</td></tr>
        <tr><th>Média d’État étranger</th>
          <td>Rapport SEAE 2025 sur les manipulations de l’information d’origine étrangère. Le contrôle éditorial étatique se documente hors de la bio (RT, Sputnik, CGTN). France Télévisions et Radio France restent des médias historiques de service public.</td></tr>
        <tr><th>Agrégateur d’alerte</th>
          <td>Holton et Belair-Gagnon (2018) sur les acteurs périphériques de la production d’info. Le repérage des marques du type Cerfia, AlertesInfos ou Mediavenir s’appuie aussi sur une enquête de presse (L’ADN, 2023).</td></tr>
        <tr><th>Éditorialiste, célébrité, créateur</th>
          <td>Pew Research Center (2024) sépare le commentaire d’opinion, la notoriété acquise hors ligne et la notoriété construite sur les plateformes. Riedl, Lukito et Woolley (2023) précisent la figure de l’influenceur politique.</td></tr>
        <tr><th>Institution, association, entreprise, expert, fact-check, citoyen</th>
          <td>Sous-techniques de DISARM T0097 (institution, ONG, entreprise, expert, fact-checking, individu). La frontière personne / organisation suit Wood-Doughty, Mahajan et Dredze (2018).</td></tr>
      </table>
      <div class="mh-cite">Holt, K., Ustad Figenschou, T., &amp; Frischlich, L. (2019). Key dimensions of alternative news media.
        <em>Digital Journalism</em>, 7(7), 860–869.
        <a href="https://doi.org/10.1080/21670811.2019.1625715" target="_blank" rel="noopener noreferrer">doi:10.1080/21670811.2019.1625715</a>.</div>
      <div class="mh-cite">Cointet, J.-P., Cardon, D., Mogoutov, A., Ooghe-Tabanou, B., Plique, G., &amp; Ramaciotti Morales, P. (2021).
        Uncovering the structure of the French media ecosystem. IC2S2.
        <a href="https://arxiv.org/abs/2107.12073" target="_blank" rel="noopener noreferrer">arXiv:2107.12073</a>.</div>
      <div class="mh-cite">European External Action Service (2025). 3rd EEAS Report on Foreign Information Manipulation and Interference Threats.
        <a href="https://www.eeas.europa.eu/eeas/3rd-eeas-report-foreign-information-manipulation-and-interference-threats-0_en" target="_blank" rel="noopener noreferrer">eeas.europa.eu</a>.</div>
      <div class="mh-cite">Pew Research Center (2024, 8 octobre). Appendix A: Account classification instruction prompt.
        <a href="https://www.pewresearch.org/data-labs/2024/10/08/appendix-a-account-classification-instruction-prompt-tiktok-2024/" target="_blank" rel="noopener noreferrer">pewresearch.org</a>.
        Riedl, M. J., Lukito, J., &amp; Woolley, S. C. (2023). Political influencers on social media: An introduction.
        <em>Social Media + Society</em>, 9(2).
        <a href="https://doi.org/10.1177/20563051231177938" target="_blank" rel="noopener noreferrer">doi:10.1177/20563051231177938</a>.</div>
      <div class="mh-cite">Wood-Doughty, Z., Mahajan, P., &amp; Dredze, M. (2018). Johns Hopkins or johnny-hopkins: Classifying individuals versus organizations on Twitter.
        <em>PEOPLES Workshop</em>, ACL.
        <a href="https://aclanthology.org/W18-1108/" target="_blank" rel="noopener noreferrer">aclanthology.org/W18-1108</a>.</div>

      <h3>Comment c’est codé dans ce connectome</h3>
      <p>Codage du <strong>28 octobre 2026</strong>. Indices lus&nbsp;: handle, nom affiché, et bio lorsqu’un export SQL en contient une.
        Des listes de référence (rédactions, partis, institutions, médias d’État déjà documentés) complètent les profils peu bavards.
        Le texte des tweets n’attribue pas la catégorie. Aucune publication récente n’est relue, contrairement au protocole Pew.</p>

      <div class="mh-caveat"><strong>Ce que la couleur ne dit pas.</strong>
        La grille n’a pas été double-codée. Krippendorff (2018) fixe α ≥ 0,667 avant d’en publier les résultats&nbsp;:
        ce seuil n’est pas atteint. La couleur n’établit ni l’authenticité, ni un bot, ni une position dans le réseau.
        Ces questions relèvent d’autres cadres (DISARM T0143, Gorwa et Guilbeault 2020, González-Bailón, Borge-Holthoefer et Moreno 2013) et ne sont pas peintes ici.</div>
    `,
  },

  connectome_typo_rules: {
    kicker: 'Connectome · typologie des comptes',
    title: 'Comment les catégories ont été tranchées',
    html: `
      <p>Codage automatique du <strong>28 octobre 2026</strong>, relu le <strong>29 octobre 2026</strong>. Une seule étiquette par compte. Le profil (handle, nom affiché, bio d’un export SQL) tranche d’abord. Les publications propres du corpus — messages originaux et réponses, pas les retweets ni les citations — ne relisent que trois issues&nbsp;: indéterminé, militant, citoyen.</p>
      <p>Si plusieurs rôles sont revendiqués, le premier qui s’applique l’emporte&nbsp;: mandat ou fonction publique, puis organisation, profession, notoriété, engagement, citoyen. Un élu qui appelle à la grève reste un élu.</p>
      <h3>Citoyen et militant</h3>
      <p><strong>Militant</strong> si le nom ou le début de la bio dit «&nbsp;militant&nbsp;», «&nbsp;militante&nbsp;», «&nbsp;activiste&nbsp;» ou «&nbsp;activist&nbsp;», ou «&nbsp;je suis militant / activiste&nbsp;». Sans bio utile, le compte le devient aussi quand il a au moins quatre publications propres, dont au moins deux, et au moins 20&nbsp;%, portent une identité militante ou un appel à agir ensemble&nbsp;: pétition, grève, manifestation, «&nbsp;exigeons&nbsp;», «&nbsp;le gouvernement doit&nbsp;», «&nbsp;intolérable&nbsp;», «&nbsp;ça suffit&nbsp;», «&nbsp;rappelons que le gouvernement&nbsp;». Un avis isolé ne suffit pas.</p>
      <p><strong>Citoyen</strong>&nbsp;: une bio personnelle, sans ce mot et sans autre rôle public, ou un profil militant dont au moins quatre publications propres ne contiennent aucun de ces indices. Ce n’est pas un militant dont on n’a pas assez de messages pour relire l’activité. Violet pour le militant, jaune pour le citoyen, y compris dans les macro-classes.</p>
      <p><strong>Indéterminé</strong>&nbsp;: profil vide ou trop court, et publications absentes, trop peu nombreuses, ou sans cette pratique répétée.</p>
      <h3>Autres cas fréquents</h3>
      <ul>
        <li>Médias&nbsp;: une enseigne déjà documentée, ou un compte qui se présente lui-même comme média, chaîne, agence de presse ou fil d’alerte (nom et bio, pas les messages). Une personne qui parle des médias, ou qui dit y travailler, ne devient pas un média pour autant. Times Now est une chaîne d’information, BRICS News un média en ligne qui dit ne pas être un compte gouvernemental, le fil covid19_disease un fil d’alerte sanitaire.</li>
        <li>Ancien ministre, député ou maire&nbsp;: activité actuelle, avec le drapeau ancien. Le compte du parti n’est pas un élu.</li>
        <li>Porte-parole d’un parti&nbsp;: mandat politique. Le compte du parti&nbsp;: parti ou mouvement.</li>
      </ul>
      <div class="mh-caveat"><strong>Ce que la couleur ne dit pas.</strong>
        Pas de double codage. L’accord de Krippendorff n’a pas été mesuré. La couleur n’établit ni l’authenticité, ni un bot, ni une position dans le réseau.</div>
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

  function setExpanded(on) {
    const value = on ? 'true' : 'false';
    helpBtn.setAttribute('aria-expanded', value);
    const typoOpen = on && currentTopic === 'connectome_typo';
    const rulesOpen = on && currentTopic === 'connectome_typo_rules';
    document.getElementById('typoHelpBtn')?.setAttribute('aria-expanded', typoOpen ? 'true' : 'false');
    document.getElementById('typoLegendHelp')?.setAttribute('aria-expanded', rulesOpen ? 'true' : 'false');
  }

  function open(forcedId) {
    const explicit = typeof forcedId === 'string' && TOPICS[forcedId];
    const id = explicit ? forcedId : getTopic();
    tabsWrap.hidden = explicit ? true : !showTabs;
    renderTopic(TOPICS[id] ? id : 'connectome_all');
    overlay.classList.add('open');
    setExpanded(true);
    closeBtn.focus();
  }
  function close() {
    overlay.classList.remove('open');
    setExpanded(false);
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

  return { open, close, renderTopic, button: helpBtn, topic: () => currentTopic };
}

export { TOPICS };
