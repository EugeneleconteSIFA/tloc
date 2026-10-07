// The Legend of Camille — la Thaïlande : la baie des pitons (acte III, la Cloche des Îles)
// =====================================================================
// « Petites îles de calcaire très hautes, temples, jungle, eau, mousson. La mer bouge. Les îles
// sont figées. La pluie reste suspendue » (STORY.md). Eugène a envoyé cinq extraits le
// 2 octobre et demandé un mélange : Ko Panyi (le village sur pilotis : le marché flottant, la
// porte de l'île), Khao Phing Kan et Ko Tapu (les pitons), Railay (les falaises et les
// grottes), Phi Phi (Ton Sai), et le Wat Tham Suea, haussé en grand piton. Ils sont fondus
// dans UNE baie inventée (carte/mondes/repere_thailande.py) ; les passeurs vont de l'une à
// l'autre. Le 4 octobre, chaque île est ramenée à son cœur, quelques centaines de mètres autour
// de ce qui sert (Eugène : « les îles sont trop grandes ») ; les plans complets d'avant sont dans
// carte/mondes/complet/.
// =====================================================================
import { monde } from './monde.js';
import { THREE, TAU, rand, phMat, mesh, boxG, showMessage, showMenu, hideMenu, fadeTo, player, state, G, scene, camera, hemi, sun, dialogue, TOUCHES, AIDE, SFX, saveGame, cutscene, keys as PNJ_KEYS, addBox, addCap, indexCapsules, world, spawnEnemy, KINDS, setMaker, setAnimHook, burst, damagePlayer, enemies } from './engine.js?v=41';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { especeGeo } from './foret.js';
import * as PNJ from './pnj.js';
import * as BOURSE from './bourse.js';

// Les embarcadères des passeurs : un par île (les pontons d'OSM ; le grand piton n'en a pas,
// on accoste sur sa grève sud). `ici` : où Camille pose le pied (le relief y est à 1–3 m) ;
// `barque` : où le bateau attend, en eau profonde (relevés sur relief-thailande.json).
const QUAIS = {
  panyi:  { nom: 'Ko Panyi, le village sur pilotis', ici: [118, 7.5], barque: [131, 9] },
  tapu:   { nom: 'Khao Phing Kan, les pitons', ici: [-701, 551], barque: [-689, 552] },
  suea:   { nom: 'le grand piton', ici: [985, 491], barque: [993, 512] },      // la grève sud, recalée le 4 octobre (le flanc a remplacé la plaine)
  railay: { nom: 'Railay, les falaises', ici: [-656.6, 1529.5], barque: [-669, 1535] },
  phiphi: { nom: 'Phi Phi, l’isthme de Ton Sai', ici: [2187, 1927], barque: [2191, 1941] },
};
const PASSEUR = {
  panyi: 'Somsak, le vieux passeur, ne quitte pas son moteur des yeux. « Les îles ne bougent plus. La mer, si. Alors on va sur la mer. Je conduisais les moines à Ton Sai, chaque matin. Depuis, plus personne ne descend de la colline. »',
  tapu: 'Mali, sa petite-fille, tient la barre debout. « Je te ramène. Mais vite : je n’aime pas rester près des pitons. »',
  suea: 'Le passeur muet ne dit rien. Il regarde le temple tout en haut, puis toi.',
  railay: 'Un passeur attend, assis dans sa barque. Il te fait signe de monter.',
  phiphi: 'Un passeur attend, assis dans sa barque. Il te fait signe de monter.',
};

// =====================================================================
//  L'ACTE III — « La Cloche des Îles » (STORY.md ; docs/DECOUPAGE-ACTE3.md, DIALOGUES-ACTE3.md)
// =====================================================================
// L'acte se joue dans cette seule baie : son avancement (state.acte3) et ce qu'on y apprend
// (state.ind3) vivent ici, comme l'acte II dans aveyron.js. Une instance du multi ne joue pas
// l'histoire : tloc-multi.js y tient le bandeau et l'arrivée, et les barques y vont partout.
const EN_INSTANCE = (() => { try { const i = JSON.parse(localStorage.getItem('tloc_instance') || 'null'); return !!(i && i.code); } catch (e) { return false; } })();
const ETAPES3 = ['gong', 'cloitre', 'mali', 'masques', 'corniche', 'yak', 'fete'];
const rang3 = (e) => ETAPES3.indexOf(e);
const atteint3 = (e) => EN_INSTANCE || rang3(state.acte3 || 'gong') >= rang3(e);
function passer3(e) { if (EN_INSTANCE || rang3(e) <= rang3(state.acte3 || 'gong')) return; state.acte3 = e; saveGame(true); }
const sait3 = (k) => !!(state.ind3 && state.ind3[k]);
function noter3(cle) {
  state.ind3 = state.ind3 || {}; if (state.ind3[cle]) return;
  state.ind3[cle] = true; saveGame(true); setTimeout(() => showMessage('Indice noté au journal (J).', 3), 300);
}
// Le carnet du journal (J) : chaque indice en gras s'y écrit, et se barre quand il a servi
const INDICES3 = {
  somsak: { txt: 'Somsak conduisait les moines à Ton Sai chaque matin. Il y va encore, contre des écus.', qui: 'Nok', fait: () => atteint3('cloitre') },
  balayeur: { txt: 'La clé du cloître, c’est le balayeur qui l’avait.', qui: 'un moine figé', fait: () => !!state.cleCloitre },
  somchai: { txt: 'Somchai balaie toujours la cour du puits, devant le cloître.', qui: 'un moine figé', fait: () => !!state.cleCloitre },
  manche: { txt: 'Il cache la clé dans sa manche gauche.', qui: 'un moine figé', fait: () => !!state.cleCloitre },
  mali: { txt: 'Mali, la petite-fille de Somsak, s’est arrêtée à Khao Phing Kan.', qui: 'Somsak', fait: () => !!state.barqueMali },
  cascade: { txt: 'La barque de Mali est restée prise dans la cascade ; le gardien de pierre est tombé en travers du bassin.', qui: 'Mali', fait: () => !!state.barqueMali },
  course: { txt: 'Battre Mali à la course, autour de Ko Tapu.', qui: 'Mali', fait: () => atteint3('masques') },
  muet: { txt: 'Le passeur muet a vu le masque de bois : il emmène à Railay.', qui: 'le passeur muet', fait: () => !!state.masqueHanuman },
  hanuman: { txt: 'Avec le masque de Hanuman, la mousson du belvédère de Ton Sai ne jette plus dans le vide.', qui: 'la grotte de Railay', fait: () => atteint3('yak') },
  muetGreve: { txt: 'Le passeur muet est à la grève du grand piton. Il n’emmène que ceux qui lui montrent un masque.', qui: 'Mali', fait: () => sait3('muet') },
};
function indices3() {
  if (!state.ind3) return '';
  const l = Object.keys(INDICES3).filter((k) => state.ind3[k]).map((k) => { const i = INDICES3[k], f = i.fait();
    return `<div style="margin:4px 0;${f ? 'opacity:.5;text-decoration:line-through' : ''}">${i.txt} <span style="opacity:.6">— ${i.qui}</span></div>`; });
  return l.length ? `<h3 style="margin:18px 0 6px;color:#9fd0ff;font-size:16px;letter-spacing:1px">INDICES</h3><div style="padding:8px 14px;border-left:4px solid #9fd0ff;background:rgba(255,255,255,.06);border-radius:6px">${l.join('')}</div>` : '';
}
// LES TRAJETS : depuis l'arrêt du temps, les passeurs ne se parlent plus et chacun reste à son
// ponton (STORY.md). Camille les rétablit un à un ; une barque ne va que là où un trajet est
// ouvert. Un trajet, c'est une paire de quais, dans les deux sens.
const TRAJETS = [
  ['panyi', 'phiphi', () => true],                                   // Somsak : il conduisait les moines à Ton Sai
  ['panyi', 'tapu', () => atteint3('mali')],                          // Somsak, vers sa petite-fille
  ['tapu', 'phiphi', () => atteint3('masques')], ['tapu', 'suea', () => atteint3('masques')], ['panyi', 'suea', () => atteint3('masques')],   // Mali reprend la mer
  ['suea', 'railay', () => sait3('muet')], ['railay', 'phiphi', () => sait3('muet')], ['railay', 'panyi', () => sait3('muet')],                // le passeur muet
];
const trajetOuvert = (a, b) => EN_INSTANCE || TRAJETS.some(([p, q, ok]) => ((p === a && q === b) || (p === b && q === a)) && ok());
const A3 = { pret: false };

// ---------- les maisons sur pilotis de Ko Panyi ----------
// OSM ne dessine que les passerelles du village (52 chemins, 24 pontons) : les maisons, on
// les pose de part et d'autre, tous les 9 m, sur pilotis au-dessus de l'eau ou du platelage.
function pilotis({ hauteur, scene, PLAN, inscrire }) {
  const ile = PLAN.cote.iles.find((i) => i.nom === 'Ko Panyi');
  const dansP = (x, z, pts) => { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; };
  // les murs en quatre lots : à Ko Panyi, les planches des maisons sont peintes, et la peinture a
  // passé au sel — bleu, vert d'eau, crème, ou le bois nu
  const murs = [[], [], [], []], toits = [], pieux = [], poses = [];
  const voies = [...PLAN.chemins, ...PLAN.ponts].filter((c) => c.m === 'panyi' && c.pts.length >= 2);
  // toutes les passerelles, segment par segment : une maison ne se pose pas EN TRAVERS d'une autre
  // (banc lieu-thailande, 2 octobre : 195 points de passerelle bloqués par des maisons voisines)
  const segs = voies.flatMap((c) => c.pts.slice(1).map((q, k) => [c.pts[k], q]));
  const dSeg = (x, z, [a, b]) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); };
  for (const c of voies) for (let k = 0; k < c.pts.length - 1; k++) {
    const [a, b] = [c.pts[k], c.pts[k + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 6) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    for (let s = 4; s < L - 3; s += 9) for (const cote of [-1, 1]) {
      const w = rand(5, 7), d = rand(5, 8), off = 1.6 + d / 2;
      const x = a[0] + ux * s - uz * off * cote, z = a[1] + uz * s + ux * off * cote;
      if (hauteur(x, z) > 3 || poses.some(([px, pz]) => Math.hypot(px - x, pz - z) < 6.5)) continue;   // pas sur le rocher, pas l'une dans l'autre
      if (x > 84 && x < 109 && z > 10 && z < 58) continue;      // le marché flottant et ses deux abords restent libres
      if (segs.some((sg) => sg[0] !== a && dSeg(x, z, sg) < Math.max(w, d) / 2 + 1.0)) continue;
      if (ile && !dansP(x, z, ile.pts) && Math.random() < 0.35) continue;
      poses.push([x, z]);
      const ang = Math.atan2(uz, ux), hm = rand(2.6, 3.4), y0 = 1.3;
      const g = new THREE.BoxGeometry(w, hm, d); g.rotateY(-ang); g.translate(x, y0 + hm / 2, z); murs[Math.floor(Math.random() * murs.length)].push(g.toNonIndexed());
      // un toit de tôle à deux pans, faîtage le long de la passerelle
      // (rotateX de −π/2 : avec +π/2, l'arête du prisme pointait vers le BAS — des toits en V, sur
      // toutes les captures de Ko Panyi jusqu'au 5 octobre)
      const t = new THREE.CylinderGeometry(d * 0.62, d * 0.62, w + 0.8, 3, 1); t.rotateZ(Math.PI / 2); t.rotateX(-Math.PI / 2); t.scale(1, 0.45, 1);
      t.rotateY(-ang); t.translate(x, y0 + hm + d * 0.14, z); toits.push(t.toNonIndexed());
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.CylinderGeometry(0.12, 0.14, 4, 5); p.translate(x + px * w * 0.42, y0 - 1.9, z + pz * d * 0.42); pieux.push(p.toNonIndexed()); }
      const ca = Math.cos(ang), sa = Math.sin(ang), coin = (p, q) => [x + p * ca - q * sa, z + p * sa + q * ca];
      const coins = [coin(-w / 2, -d / 2), coin(w / 2, -d / 2), coin(w / 2, d / 2), coin(-w / 2, d / 2)];
      inscrire(coins, x, z);
      BATI.facades.push({ pts: coins, haut: y0 + hm, m: 'panyi', sol: y0 });        // fenêtres et portes : batiIles()
    }
  }
  const uvm = (g) => { g.deleteAttribute('uv'); g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal, uv = [];
    for (let k = 0; k < p.count; k++) uv.push(p.getX(k) * Math.abs(n.getZ(k)) + p.getZ(k) * Math.abs(n.getX(k)) + (Math.abs(n.getY(k)) > 0.7 ? p.getX(k) : 0), Math.abs(n.getY(k)) > 0.7 ? p.getZ(k) : p.getY(k));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; };
  [0x9c8a74, 0x7e98a4, 0x8ea890, 0xcabda0].forEach((c, k) => { if (!murs[k].length) return;
    const m = new THREE.Mesh(mergeGeometries(murs[k].map(uvm)), phMat('hinoki_planks', 1, 1, { color: c })); m.castShadow = m.receiveShadow = true; scene.add(m); });
  // la tôle des toits, rouillée par la mer (l'enduit gris d'avant faisait un toit de ciment)
  if (toits.length) { const m = new THREE.Mesh(mergeGeometries(toits.map(uvm)), tole(0xc8b8a8)); m.castShadow = true; scene.add(m); }
  if (pieux.length) scene.add(new THREE.Mesh(mergeGeometries(pieux), phMat('tree_trunk', 1, 1, { color: 0x5a4838 })));
  // le platelage : partout où le relief de Ko Panyi est à 1,2 m (l'île basse et le long des
  // passerelles, recolter-relief-thailande.py), des planches — le village marche sur l'eau
  const v = [], pas = 2.5, plat = new Set();
  for (let z = -440; z < 420; z += pas) for (let x = -260; x < 200; x += pas) {
    const hs = [hauteur(x, z), hauteur(x + pas, z), hauteur(x, z + pas), hauteur(x + pas, z + pas)];
    // une case dont un coin est sur le platelage : la planche déborde au-dessus de l'eau, comme au bord d'une vraie passerelle
    if (hs.some((h) => h > 1.0 && h < 1.45) && hs.every((h) => h < 1.45)) { v.push(x, 0, z, x, 0, z + pas, x + pas, 0, z, x + pas, 0, z, x, 0, z + pas, x + pas, 0, z + pas); plat.add(x + ',' + z); }
  }
  if (v.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const uv = []; for (let k = 0; k < v.length; k += 3) uv.push(v[k], v[k + 2]); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, phMat('wood_planks', 1, 1, { color: 0xb8a080, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })); m.position.y = 1.28; m.receiveShadow = true; scene.add(m); }
  // le bord du platelage, là où il donne sur l'eau : un chant de 35 cm (la poutre de rive) et, tous
  // les 2,5 m, un pieu de béton qui descend dans la mer. Vu d'une barque ou du marché, le village
  // n'était qu'une feuille posée sur l'eau ; un vrai village sur pilotis montre ses jambes.
  const rive = [], pieu = [];
  for (const k of plat) { const [x, z] = k.split(',').map(Number);
    for (const [dx, dz, a, b] of [[0, -pas, [x, z], [x + pas, z]], [0, pas, [x + pas, z + pas], [x, z + pas]], [-pas, 0, [x, z + pas], [x, z]], [pas, 0, [x + pas, z], [x + pas, z + pas]]]) {
      if (plat.has((x + dx) + ',' + (z + dz)) || hauteur((a[0] + b[0]) / 2 + dx * 0.4, (a[1] + b[1]) / 2 + dz * 0.4) > 0.9) continue;     // un voisin de planches, ou la terre : pas de rive
      rive.push(a[0], 1.30, a[1], b[0], 1.30, b[1], b[0], 0.95, b[1], a[0], 1.30, a[1], b[0], 0.95, b[1], a[0], 0.95, a[1]);
      pieu.push([a[0], a[1]]);
    } }
  if (rive.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(rive, 3));
    const uv = []; for (let k = 0; k < rive.length; k += 3) uv.push(rive[k] + rive[k + 2], rive[k + 1]); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, phMat('hinoki_planks', 1, 1, { color: 0x7a6248, side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m); }
  if (pieu.length) { const g = new THREE.CylinderGeometry(0.13, 0.15, 3.2, 6); g.translate(0, -0.65, 0);
    const im = new THREE.InstancedMesh(g, phMat('enduit_gris', 1, 1, { color: 0x8a8a84 }), pieu.length), m4 = new THREE.Matrix4();
    pieu.forEach(([x, z], k) => { im.setMatrixAt(k, m4.makeTranslation(x, 0, z)); }); scene.add(im); }
}

// ---------- les voies : ce qu'on a sous les pieds ----------
// Le vrai lieu (OSM, 4 octobre) : pas une route à Railay ni à Phi Phi, des allées piétonnes — en
// béton à Railay (avec du sable et quelques pavés), en carrelage, en enrobé ou en pavés dans les
// ruelles de Ton Sai ; sur le grand piton, des rues revêtues et les escaliers du temple. monde.js
// les dessinait toutes d'une même matière (et ses rubans, tournés vers le bas, ne se voient pas
// d'en haut) : ici, chaque voie prend son revêtement, sa largeur et sa forme.
//   dalle    béton, enrobé, carrelage : une dalle de 6 cm posée sur le sol, son chant visible,
//            un bombé de 2 cm au milieu ;
//   souple   sable, terre : une largeur qui varie, des bords qui se fondent dans l'herbe ;
//   marches  les escaliers : des marches de 15 à 18 cm, posées sur la pente.
// Les hauteurs sont celles du MAILLAGE du sol (ses deux triangles par case), pas l'interpolation
// bilinéaire : sur une pente, l'écart entre les deux enfonçait le ruban de 10 à 30 cm.
const PAS_R = 10;
function solMaille(hauteur, CADRE) {
  const x0 = CADRE.x0 - 8, z0 = CADRE.z0 - 8;          // le coin du relief (monde.js : CADRE = relief + 8 m)
  return (x, z) => {
    const fx = (x - x0) / PAS_R, fz = (z - z0) / PAS_R, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const X = x0 + i * PAS_R, Z = z0 + j * PAS_R, a = hauteur(X, Z), b = hauteur(X, Z + PAS_R), c = hauteur(X + PAS_R, Z + PAS_R), d = hauteur(X + PAS_R, Z);
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
  };
}
function genreVoie(c) {
  const s = c.s || '';
  if (c.k === 'steps') return 'marches';
  if (['sand', 'dirt', 'grass', 'ground', 'earth', 'fine_gravel', 'gravel', 'unpaved'].includes(s)) return 'souple';
  if (['tiles', 'paving_stones', 'unhewn_cobblestone'].includes(s)) return 'carreaux';
  if (['concrete', 'paved', 'asphalt', 'wood'].includes(s)) return 'dalle';
  // sans revêtement dit : dans un village (Railay, Ton Sai, le temple), la dalle de béton des
  // allées thaïes ; ailleurs, un sentier de terre
  return c.r >= 1 || c.m === 'suea' ? 'dalle' : 'souple';
}
function voies({ hauteur, PLAN, CADRE, scene }) {
  // les rubans de monde.js sont retirés : sinon, le jour où ils se verront d'en haut, deux voies
  // l'une sur l'autre
  for (const o of [...scene.children]) if (o.isMesh && o.material && o.material.userData.ph === 'rocky_trail' && o.material.polygonOffset) scene.remove(o);
  const H = solMaille(hauteur, CADRE), G = { dalle: [], carreaux: [], souple: [], marches: [], beton: [], planches: [] };
  // Ko Panyi : les ruelles du village sont des dalles de béton coulées sur pilotis, larges de deux
  // mètres (OSM : 1,3 km de béton, 110 m de planches). Le platelage (pilotis()) est à 1,28 m : la
  // ruelle s'y pose, 4 cm plus haut — sans elle, le village n'était qu'un plancher brun d'un
  // seul tenant, sans une rue où marcher.
  const HP = (x, z) => Math.max(1.28, H(x, z));
  for (const c of [...PLAN.chemins, ...PLAN.routes]) {
    if (c.surface || c.pts.length < 2) continue;
    if (c.m === 'panyi') {
      const g = c.s === 'wood' ? 'planches' : 'beton', pts = [];
      for (let k = 0; k < c.pts.length - 1; k++) { const [a, b] = [c.pts[k], c.pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
        for (let t = 0; t < n; t++) pts.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); }
      pts.push(c.pts[c.pts.length - 1]);
      let cur = []; const fin = () => { if (cur.length > 1) G[g].push(ruban3(cur, g === 'planches' ? 1.6 : 2.0, g, HP)); cur = []; };
      for (const q of pts) { if (hauteur(q[0], q[1]) > 0.9) cur.push(q); else fin(); }
      fin(); continue;
    }
    const g = genreVoie(c), w0 = c.r >= 2 ? 4.2 : c.r === 1 ? 2.6 : c.k === 'steps' ? 2.2 : g === 'souple' ? 1.6 : 1.9;
    // un point tous les mètres (35 cm pour les marches), sur la terre seulement
    const pas = g === 'marches' ? 0.35 : 1;          // les marches : assez de points pour marquer chaque contremarche
    const pts = []; for (let k = 0; k < c.pts.length - 1; k++) { const [a, b] = [c.pts[k], c.pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / pas));
      for (let t = 0; t < n; t++) pts.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); }
    pts.push(c.pts[c.pts.length - 1]);
    let cur = []; const fin = () => { if (cur.length > 1) G[g].push(ruban3(cur, w0, g, H)); cur = []; };
    for (const q of pts) { if (hauteur(q[0], q[1]) > 0.15) cur.push(q); else fin(); }
    fin();
  }
  const M = {
    dalle: phMat('enduit_gris', 2, 2, { color: 0xc8c2b4, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    carreaux: phMat('worn_tile_floor', 1, 1, { color: 0xc8b8a0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    souple: phMat('gravier', 2, 2, { color: 0xd8c098, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    marches: phMat('old_stone_wall_02', 1, 1, { color: 0xb8b0a0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    // le béton des ruelles de Ko Panyi : gris clair, taché d'eau ; les planches, plus pâles que le
    // platelage, posées en travers (les UV : le long de la ruelle, s)
    beton: phMat('enduit_gris', 2, 2, { color: 0xb4b2aa, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    planches: phMat('wood_planks', 1.2, 1.2, { color: 0xa89070, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  };
  for (const [k, l] of Object.entries(G)) if (l.length) { const m = new THREE.Mesh(mergeGeometries(l), M[k]); m.receiveShadow = true; if (k === 'souple') m.renderOrder = 1; scene.add(m); }
}
// un ruban qui regarde vers le haut, sa coupe faite de cinq points (bord, épaule, milieu, épaule, bord)
function ruban3(pts, w0, genre, H) {
  const pos = [], uv = [], col = [], idx = []; let s = 0, prec = null;
  const coupe = genre === 'souple' ? [[-1.25, -0.02, 0], [-0.6, 0.03, 1], [0, 0.04, 1], [0.6, 0.03, 1], [1.25, -0.02, 0]]
    // sur le platelage de Ko Panyi : une dalle mince, à plat (on y marche à 1,2 m ; plus épaisse, les pieds s'y enfonçaient)
    : genre === 'beton' || genre === 'planches' ? [[-1, -0.01, 1], [-1, 0.04, 1], [0, 0.045, 1], [1, 0.04, 1], [1, -0.01, 1]]
    : [[-1, -0.04, 1], [-1, 0.06, 1], [0, 0.08, 1], [1, 0.06, 1], [1, -0.04, 1]];     // la dalle : chant, dessus bombé, chant
  const n = coupe.length;
  for (let k = 0; k < pts.length; k++) {
    const [x, z] = pts[k], [xa, za] = pts[Math.max(0, k - 1)], [xb, zb] = pts[Math.min(pts.length - 1, k + 1)];
    let dx = xb - xa, dz = zb - za; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (k) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
    // la largeur : régulière pour une dalle, irrégulière (deux sinus) pour un sentier
    const w = genre === 'souple' ? w0 * (1 + 0.22 * Math.sin(s * 0.37 + x * 0.05) + 0.12 * Math.sin(s * 1.3)) : w0;
    // les marches : la hauteur du sol arrondie à 16 cm le long de la pente
    const yc = H(x, z), ym = genre === 'marches' ? Math.round(yc / 0.16) * 0.16 : null;
    for (const [c, dy, a] of coupe) {
      const px = x - dz * w / 2 * c, pz = z + dx * w / 2 * c;
      pos.push(px, (ym != null && Math.abs(dy) < 0.07 ? Math.max(ym, H(px, pz)) : H(px, pz)) + dy, pz);
      uv.push(c * w / 2, s); col.push(1, 1, 1, a);
    }
    if (k) { const b = (k - 1) * n; for (let q = 0; q < n - 1; q++) idx.push(b + q, b + q + 1, b + n + q, b + q + 1, b + n + q + 1, b + n + q); }   // vers le haut : (B−A)×(C−A) a un y positif
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals(); return g.toNonIndexed();
}

// ---------- la roche à nu et le sable ----------
// Un seul sol couvre la baie (l'herbe de la jungle) ; son matériau est retouché pour y fondre
// le calcaire là où la pente se redresse — les parois des pitons — et le sable sur les grèves,
// juste au-dessus de la mer. Le mélange se fait au pixel, selon la normale et l'altitude :
// des cases de 5 m posées par-dessus faisaient des créneaux sur chaque paroi.
function parois() {
  const sol = scene.children.find((o) => o.isMesh && o.material && o.material.userData.ph === 'grass_ground');
  if (!sol) return;
  const roche = phMat('roche_cotiere', 1, 1).map, sable = phMat('gravier', 1, 1).map;
  if (!roche || !sable) return;
  for (const t of [roche, sable]) t.repeat.set(1, 1);
  const m = sol.material;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tRoche = { value: roche }; sh.uniforms.tSable = { value: sable };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMonde; varying vec3 vNMonde;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMonde = (modelMatrix * vec4(transformed, 1.0)).xyz; vNMonde = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tRoche; uniform sampler2D tSable; varying vec3 vMonde; varying vec3 vNMonde;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 n = normalize(vNMonde), a = abs(n); a /= (a.x + a.y + a.z);
        // le calcaire, en projection sur les trois plans (une paroi verticale n'étire pas sa texture)
        vec3 r = texture2D(tRoche, vMonde.zy / 6.0).rgb * a.x + texture2D(tRoche, vMonde.xz / 6.0).rgb * a.y + texture2D(tRoche, vMonde.xy / 6.0).rgb * a.z;
        r *= vec3(1.18, 1.12, 1.04);                 // le calcaire de Phang Nga : pâle, un peu chaud
        // des coulures sombres et rousses le long des parois, comme sur les vrais pitons
        float coul = smoothstep(0.55, 0.9, sin(vMonde.x * 0.21 + sin(vMonde.y * 0.05) * 2.0) * sin(vMonde.z * 0.17 + vMonde.x * 0.03));
        r = mix(r, r * vec3(0.55, 0.5, 0.45), coul * 0.6);
        float paroi = smoothstep(0.82, 0.6, n.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, r, paroi);
        float greve = smoothstep(3.2, 1.6, vMonde.y) * (1.0 - paroi) * step(-1.5, vMonde.y);
        // le sable des plages de Phang Nga est clair et doré : le gravier tel quel était gris (le
        // « disque gris » du grand piton, Eugène, 4 octobre)
        diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(tSable, vMonde.xz / 3.0).rgb * vec3(1.32, 1.17, 0.9), greve);`);
  };
  m.customProgramCacheKey = () => 'sol-thailande';
  m.needsUpdate = true;
}

// ---------- l'esplanade du sommet ----------
// Eugène, 5 octobre : « dalle la ». Au vrai Wat Tham Suea, le sommet est une esplanade de dalles
// autour des temples et du grand chedi ; ici, l'herbe de la jungle y était restée quand on en a ôté
// les arbres. Les dalles couvrent le grand piton au-dessus de 100 m (le plateau et la bosse du
// chedi), par cases de 2,5 m, là où la pente reste sous 0,6 : les bords de falaise gardent leur
// roche. Les hauteurs sont celles du MAILLAGE du sol (solMaille), 3 cm au-dessus, comme les voies.
function esplanade({ hauteur, CADRE, PLAN, scene }) {
  const S = PLAN.morceaux && PLAN.morceaux.suea; if (!S) return;
  const H = solMaille(hauteur, CADRE), pas = 2.5, v = [], uv = [];
  for (let z = Math.floor(S.z0 / pas) * pas; z < S.z1; z += pas) for (let x = Math.floor(S.x0 / pas) * pas; x < S.x1; x += pas) {
    const c = [[x, z], [x + pas, z], [x + pas, z + pas], [x, z + pas]], hs = c.map(([a, b]) => H(a, b));
    if (Math.min(...hs) < 100 || Math.max(...hs) - Math.min(...hs) > 0.6 * pas) continue;
    const p = c.map(([a, b], k) => [a, hs[k] + 0.03, b]);
    v.push(...p[0], ...p[3], ...p[2], ...p[0], ...p[2], ...p[1]);
    for (const k of [0, 3, 2, 0, 2, 1]) uv.push(c[k][0], c[k][1]);
  }
  if (!v.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  // les dalles claires des cours des temples thaïs. worn_tile_floor a le bon dessin (des dalles et
  // leurs joints) mais c'est un carrelage sombre : le plateau faisait une tache noire vu d'en haut ;
  // la couleur ne peut pas dépasser le blanc, alors on l'éclaircit dans le shader, comme parois()
  // retouche la roche — la pierre pâlit, les joints restent marqués. (Le marbre, essayé, n'a pas de
  // joints : on aurait dit de la terre craquelée.)
  const mat = phMat('worn_tile_floor', 1.6, 1.6, { color: 0xffffff, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\n diffuseColor.rgb = min(diffuseColor.rgb * vec3(2.25, 2.15, 1.95), vec3(0.95));'); };
  mat.customProgramCacheKey = () => 'dalles-esplanade';
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
}

// ---------- la jungle ----------
// Partout où la terre monte au-dessus des grèves et où la pente tient un arbre : un semis
// serré (tous les 7 m, décalé au hasard), qui laisse à nu les parois et les villages.
function jungle({ hauteur, bloque, CADRE, PLAN }) {
  const esp = especeGeo('charme'); if (!esp) return;
  const pts = [], pas = 7;
  // les chemins restent dégagés : leurs points tous les 2 m, rangés par case de 4 m (on teste
  // la case de l'arbre et ses voisines) — des troncs se dressaient au milieu des rues de Ton Sai
  const chemin = new Set();
  for (const c of [...PLAN.chemins, ...PLAN.routes]) { if (c.surface) continue;
    for (let k = 0; k < c.pts.length - 1; k++) { const [a, b] = [c.pts[k], c.pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
      for (let t = 0; t <= n; t++) chemin.add(Math.floor((a[0] + (b[0] - a[0]) * t / n) / 4) + ',' + Math.floor((a[1] + (b[1] - a[1]) * t / n) / 4)); } }
  const surChemin = (x, z) => { const i = Math.floor(x / 4), j = Math.floor(z / 4); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (chemin.has((i + a) + ',' + (j + b))) return true; return false; };
  // les temples du grand piton dégagés (Eugène, 5 octobre) : les houppiers font 4 à 6 m de rayon, et
  // `bloque(…, 3)` laissait les arbres mordre les toits et pousser dans les cours. Le sommet (au-dessus
  // de 100 m : le plateau et la bosse du chedi) est une esplanade, sans un arbre, comme au vrai temple ;
  // ailleurs, 12 m de libre autour de chaque bâtiment du grand piton.
  const S = PLAN.morceaux && PLAN.morceaux.suea, temples = PLAN.batiments.filter((b) => b.m === 'suea').map((b) => {
    const xs = b.pts.map((q) => q[0]), zs = b.pts.map((q) => q[1]); return [Math.min(...xs) - 12, Math.max(...xs) + 12, Math.min(...zs) - 12, Math.max(...zs) + 12]; });
  const auTemple = (x, z, h) => (S && x > S.x0 && x < S.x1 && z > S.z0 && z < S.z1 && h > 100) || temples.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  for (let z = CADRE.z0; z < CADRE.z1; z += pas) for (let x = CADRE.x0; x < CADRE.x1; x += pas) {
    const px = x + rand(-3, 3), pz = z + rand(-3, 3), h = hauteur(px, pz); if (h < 3.5) continue;
    const pente = Math.max(Math.abs(hauteur(px + 2, pz) - hauteur(px - 2, pz)), Math.abs(hauteur(px, pz + 2) - hauteur(px, pz - 2))) / 4;
    if (pente > 0.75 || (pente > 0.5 && Math.random() < 0.5) || bloque(px, pz, 3) || surChemin(px, pz)) continue;
    // ni dans l'escalier du grand piton, ni à moins de 4 m (seuls ses parapets sont inscrits dans les collisions)
    if ([[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]].some(([a, b]) => solEscalier(px + a, pz + b) != null)) continue;
    if (auTemple(px, pz, h) || RESERVES3.some(([x0, x1, z0, z1]) => px > x0 && px < x1 && pz > z0 && pz < z1)) continue;
    pts.push([px, pz, h]);
  }
  const n = pts.length, tr = new THREE.InstancedMesh(esp.tronc, esp.matT, n), hp = new THREE.InstancedMesh(esp.houppier, esp.matH, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  esp.matH.color.setHex(0x8ab070);          // le vert gorgé d'eau de la mousson, plus franc que la charmille
  pts.forEach(([x, z, h], k) => { const t = rand(6, 11); q.setFromAxisAngle(Y, rand(0, TAU)); s.set(t * rand(0.9, 1.3), t, t * rand(0.9, 1.3));
    m4.compose(v.set(x, h - 0.3, z), q, s); tr.setMatrixAt(k, m4); hp.setMatrixAt(k, m4); });
  tr.castShadow = hp.castShadow = true; scene.add(tr, hp);
}

// ---------- le cloître de Ton Sai (acte III, étape 2) ----------
// SCENARIO.md § 12 met le cloître sur une île à lui ; dans la baie resserrée, il est sur la colline
// des moines de Ton Sai (Eugène, 6 octobre), au départ du câble du grand piton : c'est là que la
// poulie a un sens. Le haut de la colline est un replat de 36 × 52 m à 132 m (sonde du 6 octobre,
// x 2592–2628, z 1710–1762) : le cloître en occupe le nord, la cour du puits le sud, devant sa
// porte. La porte fait 3 m (Camille a 0,5 m de rayon : 2,6 m au moins, cf. batut.js).
const CLOITRE = { x0: 2596, x1: 2622, z0: 1706, z1: 1726, porte: [2607.5, 2610.5], puits: [2603, 1743],
  cuisine: { x0: 2612, z1: 1714, porte: [2615, 2618] }, masque: [2596.9, 1718], vantaux: [], fermee: null };
// les places que l'acte garde libres d'arbres : jungle() les évite
const RESERVES3 = [[2588, 2632, 1700, 1765]];
function cloitre({ hauteur, inscrire, addInteract }) {
  const C = CLOITRE, y = hauteur((C.x0 + C.x1) / 2, (C.z0 + C.z1) / 2), H = 3.2, E = 0.6;
  const chaux = phMat('chaux_craquelee', 9, 1.2, { color: 0xf2ece0 }), tuiles = phMat('clay_roof_tiles_02', 4, 1, { color: 0xb04a2a }), bois = phMat('wood_planks', 1, 2, { color: 0x7a4a2a });
  // un pan de mur : la chaux, un chaperon de tuiles qui déborde, et sa collision (toute hauteur)
  const mur = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rot = Math.atan2(x1 - x0, z1 - z0);
    // fondé jusqu'au terrain le plus bas sous lui : au bord nord du replat, le sol descend de 4 m
    // et le mur flottait. La chaux se répète selon la longueur du pan (un pan court l'étirait).
    let bas = y; for (let k = 0; k <= 10; k++) bas = Math.min(bas, hauteur(x0 + (x1 - x0) * k / 10, z0 + (z1 - z0) * k / 10));
    const haut = y + H - 0.4, hm = haut - bas + 0.6;
    const m = mesh(boxG(E, hm, L), phMat('chaux_craquelee', Math.max(1, L / 3), hm / 3, { color: 0xf2ece0 }), cx, haut - hm / 2, cz); m.rotation.y = rot; scene.add(m);
    const c = mesh(boxG(E + 0.5, 0.3, L + 0.3), tuiles, cx, y + H - 0.25, cz); c.rotation.y = rot; scene.add(c);
    for (const o of [m, c]) { o.castShadow = true; o.receiveShadow = true; }
    const ux = (x1 - x0) / L, uz = (z1 - z0) / L, nx = -uz * E / 2, nz = ux * E / 2;
    inscrire([[x0 + nx, z0 + nz], [x1 + nx, z1 + nz], [x1 - nx, z1 - nz], [x0 - nx, z0 - nz]], cx, cz);
  };
  mur(C.x0, C.z0, C.x1, C.z0); mur(C.x0, C.z0, C.x0, C.z1); mur(C.x1, C.z0, C.x1, C.z1);
  mur(C.x0, C.z1, C.porte[0], C.z1); mur(C.porte[1], C.z1, C.x1, C.z1);
  // la cuisine, dans le coin nord-est : deux murs et sa porte
  const K = C.cuisine;
  mur(K.x0, C.z0, K.x0, K.z1); mur(K.x0, K.z1, K.porte[0], K.z1); mur(K.porte[1], K.z1, C.x1, K.z1);
  // la porte du cloître : deux vantaux, et une collision qu'on vide en l'ouvrant. inscrire() garde
  // le tableau de points tel quel : le vider (length = 0) ôte l'obstacle sans toucher à la grille.
  const lv = (C.porte[1] - C.porte[0]) / 2;
  for (const [sx, gond] of [[1, C.porte[0]], [-1, C.porte[1]]]) {
    const g = new THREE.Group(); g.position.set(gond, y, C.z1); scene.add(g);
    const v = mesh(boxG(lv, 2.9, 0.12), bois, sx * lv / 2, 1.45, 0); v.castShadow = true; g.add(v);
    g.add(mesh(boxG(0.08, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: 0x2a2a28, metalness: 0.8, roughness: 0.4 }), sx * (lv - 0.25), 1.3, 0.08));
    g.userData.sens = sx; C.vantaux.push(g);
  }
  // le portail : deux piliers blancs, un toit thaï à deux étages de tuiles (rouge, liseré vert) et
  // ses cornes dorées (les chofa) — sans lui, un mur chaulé ne dit pas « temple »
  { const cx = (C.porte[0] + C.porte[1]) / 2, w = C.porte[1] - C.porte[0], g = new THREE.Group(); g.position.set(cx, y, C.z1); scene.add(g);
    const or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.3 }), vert = phMat('clay_roof_tiles_02', 2, 1, { color: 0x3a7a4a });
    for (const sx of [-1, 1]) { g.add(mesh(boxG(0.9, H + 0.8, 0.9), chaux, sx * (w / 2 + 0.45), (H + 0.8) / 2 - 0.4, 0)); g.add(mesh(new THREE.SphereGeometry(0.22, 10, 8), or, sx * (w / 2 + 0.45), H + 0.55, 0)); }
    [[w + 3.2, 1.3, H + 0.5, tuiles], [w + 1.6, 1.0, H + 1.5, vert]].forEach(([L, h, y0, m]) => {
      const t = new THREE.ConeGeometry(1, 1, 4, 1); t.rotateY(Math.PI / 4); t.scale(L / Math.SQRT2, h, 2.6 / Math.SQRT2);
      g.add(mesh(t, m, 0, y0 + h / 2, 0)); });
    for (const sx of [-1, 1]) { const c = mesh(new THREE.ConeGeometry(0.09, 0.9, 6), or, sx * (w / 2 + 1.5), H + 0.9, 0); c.rotation.z = -sx * 0.5; g.add(c); }
    g.add(mesh(new THREE.ConeGeometry(0.12, 1.1, 8), or, 0, H + 3.0, 0));
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    inscrire([[cx - w / 2 - 0.9, C.z1 - 0.45], [cx - w / 2, C.z1 - 0.45], [cx - w / 2, C.z1 + 0.45], [cx - w / 2 - 0.9, C.z1 + 0.45]], cx - w / 2 - 0.45, C.z1);
    inscrire([[cx + w / 2, C.z1 - 0.45], [cx + w / 2 + 0.9, C.z1 - 0.45], [cx + w / 2 + 0.9, C.z1 + 0.45], [cx + w / 2, C.z1 + 0.45]], cx + w / 2 + 0.45, C.z1); }
  C.fermee = [[C.porte[0], C.z1 - 0.3], [C.porte[1], C.z1 - 0.3], [C.porte[1], C.z1 + 0.3], [C.porte[0], C.z1 + 0.3]];
  inscrire(C.fermee, (C.porte[0] + C.porte[1]) / 2, C.z1);
  if (state.porteCloitre) ouvrirCloitre(true);
  addInteract({ pos: new THREE.Vector3((C.porte[0] + C.porte[1]) / 2, y, C.z1 + 1.2), r: 3, prompt: () => 'la porte du cloître', enabled: () => !state.porteCloitre, fn: () => {
    if (!state.cleCloitre) return showMessage('La porte du cloître est fermée à clé. Les moines doivent l’avoir.', 3.5);
    ouvrirCloitre(); showMessage('La clé tourne. La porte du cloître s’ouvre.', 3); SFX.dizaine && SFX.dizaine(); } });
  // la marmite du moine cuisinier, sur son foyer
  const fer = new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.7, roughness: 0.5 });
  const pierre = phMat('old_stone_wall_02', 1, 1, { color: 0x9a9080 });
  scene.add(mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.5, 12), pierre, 2619.5, y + 0.25, 1708.6));
  scene.add(mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.5, 14), fer, 2619.5, y + 0.75, 1708.6));
  inscrire([[2618.6, 1707.7], [2620.4, 1707.7], [2620.4, 1709.5], [2618.6, 1709.5]], 2619.5, 1708.6);
  // le puits de la cour, devant la porte
  { const [px, pz] = C.puits, yp = hauteur(px, pz), n = 12, pts = [];
    scene.add(mesh(new THREE.CylinderGeometry(1.1, 1.15, 0.9, 16, 1, true), pierre, px, yp + 0.45, pz));
    scene.add(mesh(new THREE.CircleGeometry(1.0, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a2a2a, roughness: 0.2 }), px, yp + 0.3, pz));
    for (let k = 0; k < n; k++) pts.push([px + Math.cos(k / n * TAU) * 1.2, pz + Math.sin(k / n * TAU) * 1.2]);
    inscrire(pts, px, pz); }
  // le masque de bois, pendu au mur ouest (SCENARIO.md : le premier masque, pour le passeur muet)
  { const [mx, mz] = C.masque, g = new THREE.Group(); g.position.set(mx, y + 1.6, mz); g.rotation.y = Math.PI / 2; scene.add(g);
    const face = mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, TAU, 0, Math.PI / 2), phMat('wood_cabinet_worn_long', 1, 1, { color: 0xa06a3a }), 0, 0, 0);
    face.rotation.x = Math.PI / 2; face.scale.set(1, 0.5, 1.3); g.add(face);
    const noir = new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 0.9 }), rouge = new THREE.MeshStandardMaterial({ color: 0x9a2a20, roughness: 0.6 });
    for (const sx of [-1, 1]) g.add(mesh(boxG(0.07, 0.035, 0.02), noir, sx * 0.08, 0.06, 0.105));
    g.add(mesh(boxG(0.12, 0.03, 0.02), rouge, 0, -0.12, 0.1));
    C.objetMasque = g; g.visible = !state.masqueBois;
    addInteract({ pos: new THREE.Vector3(mx + 0.8, y, mz), r: 2.5, prompt: () => 'prendre le masque de bois', enabled: () => !state.masqueBois, fn: () => {
      state.masqueBois = true; g.visible = false; SFX.pickup && SFX.pickup();
      showMessage('Un masque de bois peint, usé par les mains. Le passeur muet n’emmène que ceux qui en montrent un.', 5);
      finCloitre(); } }); }
}
function ouvrirCloitre(deja = false) {
  const C = CLOITRE; state.porteCloitre = true; if (!deja) saveGame(true);
  if (C.fermee) C.fermee.length = 0;
  for (const g of C.vantaux) g.rotation.y = g.userData.sens * 1.9;
}
// la poulie et le masque en poche : Somsak ouvre le trajet vers sa petite-fille
// ---------- la fin de l'acte (étape 7) ----------
// SCENARIO.md § 12, « La fin de l'acte » ; STORY.md : le souffle, l'écume, « Tu sonnes pour lui. »
// La Cloche des Îles : haute et fine, bronze clair couvert de feuilles d'or, sans battant (on la
// frappe du dehors) — DECISIONS-RECIT.md § 2.
function faireClocheIles() {
  const g = new THREE.Group(), bronze = new THREE.MeshStandardMaterial({ color: 0xc8a060, metalness: 0.85, roughness: 0.3 }), or = new THREE.MeshStandardMaterial({ color: 0xe8c060, metalness: 0.95, roughness: 0.18 });
  g.add(mesh(new THREE.LatheGeometry([[0, 1.5], [0.18, 1.5], [0.3, 1.38], [0.36, 1.0], [0.42, 0.5], [0.55, 0.12], [0.62, 0]].map(([r, h]) => new THREE.Vector2(r, h)), 24), bronze, 0, 0, 0));
  for (let k = 0; k < 5; k++) { const b = mesh(new THREE.TorusGeometry(0.36 + k * 0.05, 0.018, 6, 24), or, 0, 1.15 - k * 0.24, 0); b.rotation.x = Math.PI / 2; g.add(b); }
  g.add(mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), or, 0, 1.6, 0));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material.side = THREE.DoubleSide; } });
  g.userData.dynamic = true; return g;
}
// la course des longues barques, devenue une fête : les passeurs tournent sans fin au large du marché
const FETE = { barques: [], c: null, r: 22, a: 0 };
function feteBarques() {
  if (FETE.barques.length || !HAUT) return;
  // un cercle d'eau libre près du marché : le premier dont tout le tour a du fond
  FETE.c = [[200, 20], [210, -30], [220, 70], [150, -40]].find(([cx, cz]) => { for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; if (HAUT(cx + Math.cos(a) * (FETE.r + 8), cz + Math.sin(a) * (FETE.r + 8)) > -1) return false; } return true; });
  if (!FETE.c) return;
  for (const [k, pilote] of [['pecheur', 0x6a7a5a], ['nok', 0x3a6aa0], ['pecheur', 0x3a3a38], ['pecheur', 0x8a5a3a], ['pecheur', 0x4a5a7a]].entries()) {
    const B = barque(0, 0, 0, pilote); BARQUES.pop(); FETE.barques.push({ g: B.g, a0: k / 5 * TAU, v: 0.32 + k * 0.012 });
    // des guirlandes de jasmin à la proue (les guirlandes de Nok)
    for (let q = 0; q < 4; q++) B.g.add(mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshStandardMaterial({ color: q % 2 ? 0xf8f4e8 : 0xe8a030, roughness: 0.7 }), 0, 1.6 + q * 0.18, -7.2 - q * 0.1));
  }
}
function animeFete(dt) {
  if (!FETE.c) return; FETE.a += dt;
  for (const b of FETE.barques) { const a = b.a0 + FETE.a * b.v, x = FETE.c[0] + Math.cos(a) * FETE.r, z = FETE.c[1] + Math.sin(a) * FETE.r;
    b.g.position.set(x, Math.sin(FETE.a * 2 + b.a0) * 0.1, z);
    // la proue (−z local) dans le sens de la course : la tangente au cercle
    b.g.rotation.y = Math.atan2(Math.sin(a), -Math.cos(a)) + Math.PI; }
}
function poserFin() {
  if (!YAK.cloche) { YAK.cloche = faireClocheIles(); scene.add(YAK.cloche); }
  const [px, pz] = YAK.porte; YAK.cloche.position.set(px, HAUT(px, pz - 4) + 0.02, pz - 4); YAK.cloche.visible = true;
  feteBarques();
}
function finActe3() {
  const [px, pz] = YAK.porte, y0 = HAUT(px, pz), S = YAK.statue;
  if (!YAK.cloche) { YAK.cloche = faireClocheIles(); scene.add(YAK.cloche); }
  const cl = YAK.cloche; cl.visible = false;
  cutscene([
    { cam: [px + 9, y0 + 7, pz - 16], at: [px, y0 + 5, pz], dur: 3.2, fn: () => {
      S.position.set(px, y0, pz - 1.5); S.rotation.set(0, Math.PI, 0);      // le dos à sa porte, face au sud S.visible = true; if (S.userData.morceau) S.userData.morceau.visible = false;
      S.userData.bras.rotation.x = 0.45; }, text: 'Le Yak se relève. Il retourne devant sa porte, et plante son épée.' },
    { say: 'Il pose la main sur ta tête. Un souffle froid t’entre dans la poitrine : **le souffle du Yak.** La mer la plus froide ne te fera plus peur.', fn: () => { state.souffle = true; saveGame(true); } },
    { who: 'Le Yak', say: '**Tu sonnes pour lui.**' },
    { cam: [px + 6, y0 + 5, pz - 11], at: [px, y0 + 4, pz - 1.5], dur: 3.4, fn: () => {
      for (let k = 0; k < 6; k++) setTimeout(() => burst(px, y0 + 1 + k * 1.2, pz - 1.5, 0xf2f8fa, 26, 3.5, 1.2, 1, 2.2), k * 250);
      setTimeout(() => { S.visible = false; }, 1400); }, text: 'Il devient écume. La mer l’emporte.' },
    { cam: [990, 175, 470], at: [400, 30, 200], dur: 4.2, fn: () => { placerPluie(); }, text: 'La pluie tombe d’un coup sur toutes les îles. Les moines finissent leur geste ; les clochettes tintent.' },
    { who: 'Nok', say: 'Ce que tu as commencé…' },
    { cam: [px + 7, y0 + 4, pz - 13], at: [px, y0 + 3, pz - 4], dur: 3.6, fn: () => {
      cl.position.set(px, y0 + 14, pz - 4); cl.visible = true; YAK.descente = { t: 0, y0: y0 + 14, y1: y0 + 0.02 }; SFX.cloche && SFX.cloche(); },
      text: 'La Cloche des Îles descend du toit du temple. Dans sa gorge, le troisième morceau de la Grande Cloche.' },
    { say: 'Gravé dessous : **Chaque géant donnera ce qu’il est, et ne le reprendra pas.**', fn: () => { state.clocheIles = true; saveGame(true); } },
    { cam: [FETE.c ? FETE.c[0] + 40 : 180, 18, FETE.c ? FETE.c[1] + 40 : 80], at: [FETE.c ? FETE.c[0] : 150, 0, FETE.c ? FETE.c[1] : 40], dur: 4, fn: () => feteBarques(),
      text: 'Au large du marché, Somsak, Mali et le passeur muet font la course. Plus personne ne compte les bouées : c’est la fête.' },
  ], () => { G.freeCam = null; poserFin(); SFX.fanfare && SFX.fanfare(); showMessage('Le câble du plateau descend jusqu’au marché flottant. La porte de l’île t’attend.', 6); });
}
function animeFin(dt) {
  const D = YAK.descente; if (!D || !YAK.cloche) return;
  D.t = Math.min(1, D.t + dt / 3.2); const u = 1 - (1 - D.t) * (1 - D.t);
  YAK.cloche.position.y = D.y0 + (D.y1 - D.y0) * u; YAK.cloche.rotation.y += dt * 0.6;
  if (D.t >= 1) YAK.descente = null;
}
function finCloitre() { if (state.poulie && state.masqueBois) passer3('mali'); else saveGame(true); }

// ---------- Khao Phing Kan : Mali, la statue, la cascade, la course (acte III, étape 3) ----------
// Mali ne navigue plus : sa barque est restée prise dans la cascade du massif ouest, figée à
// mi-hauteur avec l'eau (Eugène, 6 octobre : « la cascade, je suis ok »). La statue du gardien est
// tombée en travers du bassin, sur le bord de la corniche : la force l'écarte (usage de l'acte II).
// Puis le gong : la cascade repart, la barque tombe (« faire tomber une chose suspendue »), glisse
// par-dessus la corniche et file à la mer. Mali, sa barque retrouvée, ne reprend la mer que si on la
// bat : une course autour de Ko Tapu, en longue barque qu'on mène (Eugène : « course de barque, ça
// me plaît »). Pourquoi la barque est DANS la cascade et pas au-dessus : le moteur laisse grimper
// presque toutes les pentes (tryMove), une barque en haut de la falaise ne demanderait rien.
// Les places : relevées le 6 octobre (sonde du relief) — la corniche à 13–16 m au pied de la face
// sud du massif ouest (x −760…−712, z 536–548), la face presque verticale de 20 à 52 m en x −736.
const KPK = { pied: [-736, 549], levre: [-736, 539], mer: [-736, 522], prise: 34, mali: [-697, 561],
  statue: null, statuePts: null, cascade: null, barque: null, chute: null, maliG: null, eau: [] };
function khaoPhingKan({ hauteur, inscrire, addInteract }) {
  const yP = hauteur(...KPK.pied);
  // la cascade : un voile d'eau sur la face, du haut (52 m) au bassin. Figée, elle ne bouge pas ;
  // au gong, son eau descend (le décalage de sa texture) et l'écume du bassin bat.
  const n = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.5).toFixed(2)})`; g.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 2, 6 + Math.random() * 30); } return c; })());
  n.wrapS = n.wrapT = THREE.RepeatWrapping; n.repeat.set(2, 3);
  const eau = new THREE.MeshStandardMaterial({ color: 0xcfeef2, map: n, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  KPK.eau.push(n);
  const h = 52 - yP, voile = new THREE.Mesh(new THREE.PlaneGeometry(5, h, 1, 12), eau);
  // le voile suit la paroi : chaque rangée de sommets posée juste devant la face, à sa hauteur
  { const p = voile.geometry.attributes.position;
    for (let k = 0; k < p.count; k++) { const yy = yP + (p.getY(k) + h / 2); let z = KPK.pied[1]; for (let zz = KPK.pied[1]; zz < KPK.pied[1] + 30; zz += 0.5) { if (hauteur(KPK.pied[0], zz) >= yy) { z = zz - 0.6; break; } } p.setXYZ(k, KPK.pied[0] + p.getX(k), yy, z); }
    voile.geometry.computeVertexNormals(); }
  voile.userData.dynamic = true; scene.add(voile); KPK.cascade = voile;
  const bassin = mesh(new THREE.CircleGeometry(3.4, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a9aa0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 }), KPK.pied[0], yP + 0.12, KPK.pied[1] - 1);
  scene.add(bassin);
  // la barque de Mali, prise dans l'eau figée, la proue en l'air
  { const g = new THREE.Group(), bois = phMat('wood_planks', 1.5, 1.5, { color: 0x6a4a30 });
    const coque = new THREE.LatheGeometry([[0, 0], [0.7, 0.05], [0.9, 0.45], [0.95, 0.85]].map(([r, hh]) => new THREE.Vector2(r, hh)), 12); coque.scale(1, 1, 6);
    g.add(mesh(coque, bois, 0, -0.3, 0));
    const proue = mesh(new THREE.CylinderGeometry(0.07, 0.18, 2.2, 6), bois, 0, 1, -6); proue.rotation.x = -0.6; g.add(proue);
    g.add(mesh(new THREE.ConeGeometry(0.2, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x3a6aa0, roughness: 0.8 }), 0, 1.9, -6.6));
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.userData.dynamic = true; scene.add(g); KPK.barque = g;
    if (state.barqueMali) g.visible = false;
    else { g.position.set(KPK.pied[0], KPK.prise, KPK.pied[1] + 2.5); g.rotation.set(1.1, 0.3, 0.2); } }
  // la statue du gardien, tombée en travers sur le bord de la corniche : un yak de pierre couché
  { const g = new THREE.Group(), [sx, sz] = KPK.levre, y = hauteur(sx, sz), pierre = phMat('old_stone_wall_02', 2, 2, { color: 0x8a8678 }), mousse = phMat('mousse', 1, 1, { color: 0x5a6a40 });
    g.position.set(sx, y, sz); g.rotation.y = Math.PI / 2; scene.add(g);
    g.add(mesh(boxG(1.5, 1.3, 4.6), pierre, 0, 0.6, 0));                 // le corps couché
    g.add(mesh(new THREE.SphereGeometry(0.85, 12, 10), pierre, 0, 0.75, -2.9));   // la tête, ses yeux ronds
    g.add(mesh(boxG(1.7, 0.25, 1.4), mousse, 0, 1.3, 0.6));
    for (const c of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.18, 0.7, 6), pierre, c * 0.45, 1.25, -3.3));
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData.dynamic = true; KPK.statue = g;
    KPK.statuePts = [[sx - 3.3, sz - 1], [sx + 3.3, sz - 1], [sx + 3.3, sz + 1], [sx - 3.3, sz + 1]];
    inscrire(KPK.statuePts, sx, sz);
    if (state.statueKpk) poserStatue(true);
    addInteract({ pos: new THREE.Vector3(sx, y, sz + 2), r: 3.5, prompt: () => 'pousser la statue', enabled: () => !state.statueKpk, fn: () => {
      if (!state.force) return showMessage('Une statue de gardien, tombée en travers du bassin. Elle ne bouge pas d’un pouce.', 3.5);
      poserStatue(); SFX.stomp && SFX.stomp(); showMessage('Camille pousse. Le gardien de pierre bascule par-dessus la corniche et tombe dans la mer.', 4.5); } }); }
  addInteract({ pos: new THREE.Vector3(KPK.pied[0], yP, KPK.pied[1] - 2), r: 4, prompt: () => 'regarder la cascade', enabled: () => !state.barqueMali,
    fn: () => showMessage('La cascade est arrêtée en plein saut. Une barque est prise dedans, à mi-hauteur, la proue en l’air.' + (state.gongThai ? ' (K : le gong)' : ''), 4.5) });
  // Mali, à terre, qui regarde les pitons
  { const [x, z] = KPK.mali; const v = gensDeLeau('nok', 0x3a6aa0);
    if (v) { v.position.set(x, hauteur(x, z), z); v.rotation.y = Math.atan2(KPK.pied[0] - x, KPK.pied[1] - z); scene.add(v); KPK.maliG = v; VENDEURS.push(v); if (atteint3('masques')) v.visible = false; }
    addInteract({ pos: new THREE.Vector3(x, hauteur(x, z), z), r: 3.5, prompt: () => 'parler à Mali', enabled: () => !atteint3('masques'), fn: parlerMali }); }
  // les bouées de la course, autour de Ko Tapu
  const orange = new THREE.MeshStandardMaterial({ color: 0xe0702a, roughness: 0.6 }), blanc = new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.8, side: THREE.DoubleSide });
  for (const [x, z] of COURSE.pts) { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    g.add(mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.2, 12), orange, 0, 0.2, 0)); g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 5), blanc, 0, 2, 0));
    const f = mesh(new THREE.PlaneGeometry(1.1, 0.7), blanc, 0.55, 3.1, 0); g.add(f);
    g.userData.dynamic = true; g.visible = false; COURSE.bouees.push(g); }
}
function poserStatue(deja = false) {
  state.statueKpk = true; if (!deja) saveGame(true);
  if (KPK.statuePts) KPK.statuePts.length = 0;
  if (KPK.statue) { const [x, z] = KPK.mer; KPK.statue.position.set(x, -1.6, z); KPK.statue.rotation.z = 1.3; }
}
// au gong, près du bassin : la cascade repart ; la barque tombe si la statue est écartée
function gongCascade() {
  if (state.barqueMali || KPK.chute || Math.hypot(player.pos.x - KPK.pied[0], player.pos.z - KPK.pied[1]) > GONG.r) return;
  KPK.chute = { t: 0, libre: !!state.statueKpk };
  setTimeout(() => showMessage(KPK.chute && KPK.chute.libre ? 'La cascade repart ! La barque bascule, tombe dans le bassin…' : 'La cascade repart, la barque tombe… et bute contre la statue. Le temps la reprend.', 4), 400);
}
function animeKpk(dt) {
  const coule = tempsRendu() || (gongActif() && Math.hypot(GONG.x - KPK.pied[0], GONG.z - KPK.pied[1]) < GONG.r);
  for (const t of KPK.eau) if (coule) t.offset.y += dt * 1.6;
  const C = KPK.chute; if (!C || !KPK.barque) return;
  C.t += dt; const g = KPK.barque, yB = HAUT(...KPK.pied) + 0.3;
  if (C.t < 1.6) { const u = C.t / 1.6; g.position.y = KPK.prise + (yB - KPK.prise) * u * u; g.rotation.x = 1.1 * (1 - u); }
  else if (!C.libre) { g.position.y = yB + 0.4; g.rotation.x = 0.5; if (C.t > 6) { KPK.chute = null; g.position.y = KPK.prise; g.rotation.x = 1.1; } }   // le temps la remonte où elle était
  else if (C.t < 4.5) { const u = (C.t - 1.6) / 2.9; g.position.z = KPK.pied[1] + (KPK.mer[1] - KPK.pied[1]) * u; g.position.y = yB + (0 - yB) * Math.min(1, u * 1.3); g.rotation.x = -0.4 * Math.sin(u * Math.PI); }
  else { KPK.chute = null; g.visible = false; state.barqueMali = true; saveGame(true);
    showMessage('La barque de Mali file vers la mer, et s’échoue doucement sur la plage, près d’elle.', 4.5); SFX.dizaine && SFX.dizaine(); }
}
function parlerMali() {
  if (!state.barqueMali) return dialogue([
    { who: 'Mali', text: 'Tu viens avec grand-père ? Il t’a dit que je ne naviguais plus.' },
    { who: 'Mali', text: 'Ma barque est là-haut. La crue l’a soulevée juste avant que tout s’arrête. **Elle est restée dans la cascade.**' },
    { who: 'Mali', text: 'Et le gardien de pierre est tombé en travers du bassin. Même si elle tombait, elle se briserait contre lui.', fn: () => noter3('cascade') }]);
  dialogue([
    { who: 'Mali', text: 'Ma barque ! Tu l’as fait tomber… et elle n’a rien.' },
    { who: 'Mali', text: 'Tu veux que je reprenne la mer ? Alors **bats-moi. Une course autour de Ko Tapu.** Six bouées, et on revient ici.' },
    { who: 'Mali', text: 'Prends la barque de grand-père. Z pour accélérer, S pour freiner, Q et D pour tourner.', fn: () => { noter3('course'); departCourse(); } }]);
}

// LA COURSE : Camille mène une longue barque (un mode à elle : la position de Camille suit la
// barque à chaque image, comme la tyrolienne) ; Mali, dans la sienne, suit les bouées à vitesse
// réglée. La barque ne passe que sur l'eau libre (le fond sous −0,6 m).
const COURSE = { pts: [[-690, 500], [-720, 460], [-690, 438], [-668, 472], [-675, 505], [-688, 540]], bouees: [], actif: false, auto: false };
const BARQUE_V = 15, MALI_V = 11.5;
function departCourse() {
  if (COURSE.actif) return;
  fadeTo(1, () => {
    const moi = COURSE.moi || (COURSE.moi = (() => { const g = new THREE.Group(); scene.add(g); barque(0, 0, 0, null); const b = BARQUES.pop(); g.add(b.g); b.g.position.set(0, 0, 0);
      // vue d'en haut, depuis la poupe, on voit l'INTÉRIEUR de la coque : ses faces aussi
      b.g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; } });
      return { g }; })());
    const mali = COURSE.mali || (COURSE.mali = (() => { barque(0, 0, 0, ['nok', 0x3a6aa0]); return BARQUES.pop(); })());
    Object.assign(moi, { x: -694, z: 545, rot: 0, v: 0, k: 0 }); Object.assign(mali, { x: -682, z: 545, rot: 0, k: 0 });
    moi.g.visible = true; mali.g.visible = true;
    COURSE.actif = true; COURSE.t0 = performance.now() + 3000; COURSE.fini = false;
    COURSE.camBack = G.camBack; G.camBack = 18;          // plus de recul : on voit la barque et la bouée suivante
    COURSE.bouees.forEach((b, i) => { b.visible = true; });
    placerBarques(); fadeTo(0, null);
    showMessage('Trois… deux… un…', 2.5); setTimeout(() => COURSE.actif && showMessage('Partez ! Vers la première bouée, au sud.', 3), 3000);
  });
}
const avantDe = (rot) => [-Math.sin(rot), -Math.cos(rot)];       // la proue regarde vers −z local
// le pont de la barque de Camille, pendant la course : un sol pour le moteur (solLieu), sinon il la
// croit en chute au-dessus de l'eau et lui donne la pose de la chute
function solCourse(x, z) {
  if (!COURSE.actif || !COURSE.moi) return null;
  const m = COURSE.moi, [fx, fz] = avantDe(m.rot), dx = x - m.x, dz = z - m.z, long = dx * fx + dz * fz, trav = dx * fz - dz * fx;
  return Math.abs(long) < 7 && Math.abs(trav) < 1.1 ? 0.55 : null;
}
const surEau = (x, z) => HAUT(x, z) < -0.6;
function placerBarques() {
  const { moi, mali } = COURSE;
  for (const b of [moi, mali]) { b.g.position.set(b.x, Math.sin(performance.now() / 700 + (b === moi ? 0 : 2)) * 0.08, b.z); b.g.rotation.y = b.rot; }
  // Camille debout à l'arrière, près du moteur ; la caméra suit le cap
  const [fx, fz] = avantDe(moi.rot), px = moi.x - fx * 4.6, pz = moi.z - fz * 4.6;
  player.pos.set(px, 0.55, pz); player.vy = 0; player.fallFrom = player.pos.y; player.onGround = true;      // debout dans la barque, pas en chute
  player.yaw = Math.atan2(fx, fz); G.camYaw = player.yaw;
}
function animeCourse(dt) {
  if (!COURSE.actif) return;
  const { moi, mali, pts } = COURSE, go = performance.now() > COURSE.t0, K = (c) => !!(PNJ_KEYS[c]);
  // Camille : les touches, ou le pilote du banc (COURSE.auto) qui vise la bouée suivante
  let gaz = 0, barre = 0;
  if (COURSE.auto) { const [tx, tz] = pts[Math.min(moi.k, pts.length - 1)], [fx, fz] = avantDe(moi.rot), a = Math.atan2(fx * (tz - moi.z) - fz * (tx - moi.x), fx * (tx - moi.x) + fz * (tz - moi.z)); barre = Math.max(-1, Math.min(1, -a * 2)); gaz = Math.abs(a) > 1.2 ? 0.4 : 1; }
  else { gaz = (K('KeyW') || K('ArrowUp') ? 1 : 0) - (K('KeyS') || K('ArrowDown') ? 1 : 0); barre = (K('KeyA') || K('ArrowLeft') ? 1 : 0) - (K('KeyD') || K('ArrowRight') ? 1 : 0); }
  if (!go) gaz = 0;
  moi.v += (gaz > 0 ? gaz * 6 : gaz * 9) * dt; moi.v -= moi.v * 0.35 * dt;
  moi.v = Math.max(-4, Math.min(BARQUE_V, moi.v));
  moi.rot += barre * dt * 1.15 * (0.35 + Math.min(1, Math.abs(moi.v) / 8));
  const [fx, fz] = avantDe(moi.rot), nx = moi.x + fx * moi.v * dt, nz = moi.z + fz * moi.v * dt;
  // la coque et la proue sur l'eau, sinon on bute et l'on recule un peu
  if (surEau(nx, nz) && surEau(nx + fx * 6 * Math.sign(moi.v || 1), nz + fz * 6 * Math.sign(moi.v || 1))) { moi.x = nx; moi.z = nz; }
  else { moi.v = -moi.v * 0.3; }
  if (go && moi.k < pts.length && Math.hypot(pts[moi.k][0] - moi.x, pts[moi.k][1] - moi.z) < 10) {
    moi.k++; SFX.dizaine && SFX.dizaine();
    if (moi.k < pts.length) showMessage(`Bouée ${moi.k} / ${pts.length - 1}${moi.k > mali.k ? ' — tu mènes !' : ' — Mali est devant.'}`, 2);
  }
  // Mali : droit vers sa bouée suivante, cap lissé ; un peu moins vite que la barque de Camille lancée
  if (go && mali.k < pts.length) {
    const [tx, tz] = pts[mali.k], cap = Math.atan2(-(tx - mali.x), -(tz - mali.z));
    let d = cap - mali.rot; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    mali.rot += Math.max(-1, Math.min(1, d * 2)) * dt * 1.3;
    const [mx, mz] = avantDe(mali.rot), v = MALI_V * (Math.abs(d) > 0.8 ? 0.6 : 1);
    mali.x += mx * v * dt; mali.z += mz * v * dt;
    if (Math.hypot(tx - mali.x, tz - mali.z) < 8) mali.k++;
  }
  placerBarques();
  COURSE.bouees.forEach((b, i) => { b.children[0].material.emissive && b.children[0].material.emissive.setHex(0x000000); b.position.y = Math.sin(performance.now() / 500 + i) * 0.1; b.scale.setScalar(i === moi.k ? 1.6 : 1); });
  if (!COURSE.fini && (moi.k >= pts.length || mali.k >= pts.length)) finCourse(moi.k >= pts.length);
}
function finCourse(gagne) {
  COURSE.fini = true;
  setTimeout(() => fadeTo(1, () => {
    COURSE.actif = false; G.camBack = COURSE.camBack ?? G.camBack; COURSE.moi.g.visible = false; COURSE.mali.g.visible = false; COURSE.bouees.forEach((b) => { b.visible = false; });
    const [x, z] = KPK.mali; player.pos.set(x + 2, HAUT(x + 2, z), z); player.fallFrom = player.pos.y;
    fadeTo(0, null);
    if (!gagne) return dialogue([{ who: 'Mali', text: 'Trop lente ! Grand-père t’a mal appris. Reviens me voir quand tu veux ta revanche.' }]);
    dialogue([
      { who: 'Mali', text: 'Tu rames comme une passeuse. Une vraie.' },
      { who: 'Mali', text: 'D’accord. **Je reprends la mer.** Les pitons, Ko Panyi, Ton Sai, le grand piton : où tu veux.' },
      { who: 'Mali', text: 'Le passeur muet ? **Il est à la grève du grand piton.** Il n’en bouge plus. Il n’emmène que ceux qui lui montrent un masque.', fn: () => {
        noter3('muetGreve'); passer3('masques'); if (KPK.maliG) KPK.maliG.visible = false; for (const b of BARQUES) if (b.quai === 'tapu') b.g.visible = true; } }]);
  }), 1500);
}

// ---------- Railay : la grotte des masques (acte III, étape 4) ----------
// SCENARIO.md § 12 : l'île des masques, « un mur fendu et une salle noire » (les bombes et la lanterne
// de Lille), le masque de Hanuman au fond. Dans la baie resserrée, c'est une grotte de la falaise de
// Railay : sa bouche s'ouvre dans la face sud du piton qui domine le village (relevé du 6 octobre :
// le pied à 6–7 m en (−600 ; 1664), le rocher à 30–60 m derrière). Le relief ne se creuse pas : les
// salles sont bâties à part, closes, à 600 m d'altitude (comme les caves d'aveyron.js), et la bouche y
// mène comme une porte. On ne les rend solides (addBox, addCap) que quand on y est.
// Les danseurs du khon, figés au milieu de leur danse : figés, rien ne les touche (`caged`, engine.js) ;
// le gong les remet en mouvement six secondes (« remettre un ennemi en mouvement »).
// la bouche est juste devant la paroi, qui monte d'un coup à z 1661 (sonde du 6 octobre)
const GROTTE = { x: -600, z: 1700, y: 600, bouche: [-600, 1659], g: null, phys: [], dedans: false, fendu: null, lueur: null, danseurs: [], hanuman: null };
Object.assign(KINDS, { khon: { hp: 4, speed: 4.8, dmg: 1, range: 1.9, aggro: 14, windup: 0.5, cd: 1.3, fly: 0, r: 0.55, label: 'Danseur du khon', barY: 2.1 } });
setMaker('khon', () => { const g = PNJ.buildRole('moine', 0x8a2a5a) || new THREE.Group(); g.scale.setScalar(G.echelle); g.userData.anim = true;
  const m = new THREE.Group(), or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.8, roughness: 0.3 });
  m.add(mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a6a3a, roughness: 0.5 }), 0, 0, 0)); m.add(mesh(new THREE.ConeGeometry(0.07, 0.28, 8), or, 0, 0.2, 0));
  if (g.userData.perso) PNJ.socket(g, g.userData.perso, 'Head', m, [0, 0.12, 0.04]);
  return g; });
setAnimHook('khon', (e, dt, v) => { if (e.caged) return true; if (e.mesh.userData.ctrl) PNJ.animeVillageois(e.mesh, dt, v > 0.4); return true; });
function grotte({ hauteur, scene, addInteract }) {
  const g = new THREE.Group(); g.position.set(GROTTE.x, GROTTE.y, GROTTE.z); g.visible = false; g.userData.dynamic = true; scene.add(g); GROTTE.g = g;
  const roc = phMat('rock_wall_14', 3, 2, { color: 0x8a7a68 }), sol = phMat('rocks_ground_08', 4, 4, { color: 0x7a6a58 }), plafond = phMat('rock_wall_14', 4, 4, { color: 0x5a4e44 });
  const boite = (w, h, d, m, x, y, z) => { const o = mesh(boxG(w, h, d), m, x, y, z); o.receiveShadow = true; o.castShadow = true; g.add(o); return o; };
  // l'entrée (8 × 10 m, 4,5 m sous voûte) et la salle noire (14 × 14 m, 6 m)
  boite(8, 0.4, 10, sol, 0, -0.2, 5); boite(8, 0.4, 10, plafond, 0, 4.7, 5);
  boite(14, 0.4, 14, sol, 0, -0.2, 17); boite(14, 0.4, 14, plafond, 0, 6.2, 17);
  for (const [w, h, d, x, z] of [[0.6, 4.5, 10, -4.3, 5], [0.6, 4.5, 10, 4.3, 5], [8, 4.5, 0.6, 0, -0.3], [2.7, 4.5, 0.6, -2.85, 10], [2.7, 4.5, 0.6, 2.85, 10],
    [0.6, 6, 14, -7.3, 17], [0.6, 6, 14, 7.3, 17], [14, 6, 0.6, 0, 24.3], [4.6, 1.5, 0.6, -5, 10], [4.6, 1.5, 0.6, 5, 10]]) boite(w, h, d, roc, x, h / 2, z);
  boite(14, 1.6, 0.6, roc, 0, 5.3, 10);
  // le mur fendu, entre les deux salles : une dalle zébrée de fentes noires
  const fendu = new THREE.Group(); fendu.position.set(0, 0, 10); g.add(fendu);
  fendu.add(mesh(boxG(3.0, 4.5, 0.5), phMat('rock_wall_14', 1, 1.5, { color: 0x7a6a5a }), 0, 2.25, 0));
  const noir = new THREE.MeshBasicMaterial({ color: 0x080606 });
  for (const [x, y, r, l] of [[-0.3, 2.6, 0.7, 2.2], [0.5, 1.6, -0.5, 1.6], [0.1, 3.4, 1.2, 1.2]]) { const f = mesh(boxG(0.06, l, 0.02), noir, x, y, 0.27); f.rotation.z = r; fendu.add(f); }
  GROTTE.fendu = fendu; if (state.murFendu) fendu.visible = false;
  // la lueur de la lanterne : posée dès la construction (une lumière ajoutée en jeu recompilerait tout, cf. PROMPT-REPRISE § 5)
  GROTTE.lueur = new THREE.PointLight(0xffc888, 0, 16, 1.6); g.add(GROTTE.lueur);
  // le présentoir du masque de Hanuman, au fond de la salle noire
  boite(1.2, 1.0, 0.8, phMat('wood_cabinet_worn_long', 1, 1, { color: 0x5a2a1a }), 0, 0.5, 22.6);
  { const m = new THREE.Group(); m.position.set(0, 1.45, 22.6); g.add(m);
    const blanc = new THREE.MeshStandardMaterial({ color: 0xf0eee6, roughness: 0.5 }), or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.3 });
    const face = mesh(new THREE.SphereGeometry(0.24, 14, 12), blanc, 0, 0, 0); face.scale.set(1, 1.1, 0.8); m.add(face);
    m.add(mesh(new THREE.ConeGeometry(0.16, 0.5, 10), or, 0, 0.42, 0));
    for (const sx of [-1, 1]) { m.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2a8a4a, roughness: 0.4 }), sx * 0.09, 0.05, 0.18)); m.add(mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), or, sx * 0.25, 0, 0)); }
    m.add(mesh(boxG(0.16, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0xb02a2a }), 0, -0.12, 0.18));
    GROTTE.hanuman = m; m.visible = !state.masqueHanuman; }
  // la bouche, dans la falaise de Railay : un arc de rocher et le noir derrière
  { const [bx, bz] = GROTTE.bouche, by = hauteur(bx, bz), b = new THREE.Group(); b.position.set(bx, by, bz); scene.add(b);
    const roche = phMat('rock_wall_14', 2, 2, { color: 0x8a7a68 });
    for (const sx of [-1, 1]) b.add(mesh(boxG(1.6, 5.4, 2.0), roche, sx * 2.3, 2.5, 0.4));
    b.add(mesh(boxG(6.2, 1.6, 2.2), roche, 0, 5.4, 0.4));
    { const n = mesh(new THREE.PlaneGeometry(3.0, 4.6), new THREE.MeshBasicMaterial({ color: 0x050403 }), 0, 2.3, 1.0); n.rotation.y = Math.PI; b.add(n); }
    b.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial) o.castShadow = true; });
    addInteract({ pos: new THREE.Vector3(bx, by, bz - 1.5), r: 3, prompt: () => 'entrer dans la grotte', fn: entrerGrotte }); }
  // dedans : sortir, le mur fendu, le masque (les invites ne valent qu'à 600 m : à la portée ET moins de 3 m d'écart)
  const V = (x, z, y = 0) => new THREE.Vector3(GROTTE.x + x, GROTTE.y + y, GROTTE.z + z);
  addInteract({ pos: V(0, 1), r: 2.5, prompt: () => 'sortir de la grotte', fn: sortirGrotte });
  addInteract({ pos: V(0, 8.8), r: 2.6, prompt: () => 'le mur fendu', enabled: () => !state.murFendu, fn: () => {
    if (!state.bombes) return showMessage('Le rocher est fendu de haut en bas. Une bombe le ferait céder.', 4);
    if (state.nbBombes !== undefined && state.nbBombes <= 0) return showMessage('Plus une bombe en poche.', 3);
    if (state.nbBombes !== undefined) state.nbBombes--;
    GROTTE.meche = { t: 0 }; SFX.roll && SFX.roll(); showMessage('La mèche grésille…', 1.5); } });
  addInteract({ pos: V(0, 21.6), r: 2.4, prompt: () => 'prendre le masque de Hanuman', enabled: () => !state.masqueHanuman, fn: () => {
    if (GROTTE.danseurs.some((e) => !e.dead)) return showMessage('Les danseurs figés barrent le présentoir.', 3);
    state.masqueHanuman = true; GROTTE.hanuman.visible = false; SFX.pickup && SFX.pickup(); passer3('corniche');
    dialogue([{ text: 'Le masque de Hanuman, le roi des singes : blanc, couronné d’or. Il sait marcher dans le vent.' },
      { text: '**Avec lui, la mousson du belvédère ne te jettera plus dans le vide.** Le câble du grand piton part de là.', fn: () => noter3('hanuman') }]); } });
}
function physGrotte(on) {
  if (!on) { for (const p of GROTTE.phys) { const a = world.boxes.indexOf(p), b = world.capsules.indexOf(p); if (a >= 0) world.boxes.splice(a, 1); if (b >= 0) world.capsules.splice(b, 1); }
    GROTTE.phys = []; indexCapsules(); return; }
  const { x, z, y } = GROTTE, cap = (ax, az, bx, bz, h) => { const c = addCap(x + ax, z + az, x + bx, z + bz, 0.25, y + h); c.bottom = y - 1; GROTTE.phys.push(c); return c; };
  GROTTE.phys = [addBox(x - 10, x + 10, z - 3, z + 27, y)];
  cap(-4, 0, 4, 0, 4.5); cap(-4, 0, -4, 10, 4.5); cap(4, 0, 4, 10, 4.5);
  cap(-4, 10, -1.5, 10, 4.5); cap(1.5, 10, 4, 10, 4.5);
  cap(-7, 10, -4, 10, 6); cap(4, 10, 7, 10, 6); cap(-7, 10, -7, 24, 6); cap(7, 10, 7, 24, 6); cap(-7, 24, 7, 24, 6);
  cap(-0.6, 22.6, 0.6, 22.6, 1.0);
  if (!state.murFendu) GROTTE.capFendu = cap(-1.5, 10, 1.5, 10, 4.5);
}
function entrerGrotte() {
  fadeTo(1, () => {
    physGrotte(true); GROTTE.g.visible = true; GROTTE.dedans = true;
    player.pos.set(GROTTE.x, GROTTE.y + 0.02, GROTTE.z + 2); player.vy = 0; player.fallFrom = player.pos.y; player.yaw = 0; G.camYaw = 0;
    GROTTE.camAvant = [G.camMaxY, G.camBack, G.camUp]; G.camMaxY = GROTTE.y + 4.2; G.camBack = 3.6; G.camUp = 1.9;
    GROTTE.lueur.intensity = state.lanterne ? 7 : 1.2;
    // les danseurs, une fois : figés au milieu de la salle noire
    if (!GROTTE.danseurs.length && !state.masqueHanuman) GROTTE.danseurs = [[-3, 16.5], [3, 16.5], [0, 19.5]].map(([lx, lz]) => {
      const e = spawnEnemy('khon', GROTTE.x + lx, GROTTE.z + lz, 'acte3', GROTTE.y); e.home.y = GROTTE.y; e.caged = true; e.fige = [e.pos.x, e.pos.z]; return e; });
    fadeTo(0, null);
    showMessage(state.lanterne ? 'La lanterne éclaire une grotte basse. Au fond, un mur fendu.' : 'Il fait noir. Sans la lanterne de Désiré, on n’y voit presque rien.', 4);
  });
}
function sortirGrotte() {
  fadeTo(1, () => {
    physGrotte(false); GROTTE.g.visible = false; GROTTE.dedans = false; GROTTE.lueur.intensity = 0;
    const [x, z] = GROTTE.bouche; player.pos.set(x, HAUT(x, z - 3), z - 3); player.vy = 0; player.fallFrom = player.pos.y; player.yaw = Math.PI; G.camYaw = Math.PI;
    if (GROTTE.camAvant) [G.camMaxY, G.camBack, G.camUp] = GROTTE.camAvant;
    fadeTo(0, null);
  });
}
function animeGrotte(dt) {
  if (!GROTTE.dedans) return;
  GROTTE.lueur.position.set(player.pos.x - GROTTE.x, 3, player.pos.z - GROTTE.z);
  const M = GROTTE.meche;
  if (M && (M.t += dt) > 1.5) {
    GROTTE.meche = null; state.murFendu = true; saveGame(true); GROTTE.fendu.visible = false;
    if (GROTTE.capFendu) { const b = world.capsules.indexOf(GROTTE.capFendu); if (b >= 0) world.capsules.splice(b, 1); indexCapsules(); }
    SFX.stomp && SFX.stomp(); G.shake = Math.max(G.shake || 0, 0.6); burst(GROTTE.x, GROTTE.y + 1.5, GROTTE.z + 10, 0xffa040, 30, 6, 0.7, 6, 1.6);
    showMessage('Le rocher cède ! Derrière, une salle noire, et des silhouettes immobiles.', 4);
  }
  // les danseurs : figés hors du gong (rien ne les touche, ils ne bougent pas), vivants dedans
  const vif = gongActif() && Math.hypot(GONG.x - GROTTE.x, GONG.z - (GROTTE.z + 17)) < GONG.r + 6;
  for (const e of GROTTE.danseurs) { if (e.dead) continue;
    e.caged = !vif;
    if (!vif) { e.pos.x = e.fige[0]; e.pos.z = e.fige[1]; e.kb.set(0, 0, 0); e.state = 'idle'; }
    else { e.fige = [e.pos.x, e.pos.z]; } }
}

// ---------- le belvédère de Ton Sai : la corniche des vents (acte III, étape 5) ----------
// SCENARIO.md : « la mousson jette dans le vide » ; il faut le masque de Hanuman, le roi des singes.
// Au départ du câble du grand piton, la mousson pousse Camille vers le bord, de plus en plus fort ;
// tombée, elle revient au palier de l'escalier, un cœur en moins. Avec le masque, le vent glisse.
const VENT = { x: 2605, z: 1790, r: 16, palier: [2600, 1772], dit: false };
function animeVent(dt) {
  if (EN_INSTANCE || GLISSE || !state.poulie || state.masqueHanuman || COURSE.actif) return;
  const d = Math.hypot(player.pos.x - VENT.x, player.pos.z - VENT.z);
  if (d > VENT.r) { VENT.t = 0; return; }
  VENT.t = (VENT.t || 0) + dt;
  if (!VENT.dit) { VENT.dit = true; showMessage('Une rafale de mousson ! Elle te pousse vers le bord du belvédère.', 3); }
  // vers le vide : la pente du terrain, en bas (le côté ouest de la colline)
  const h = HAUT, gx = h(player.pos.x + 2, player.pos.z) - h(player.pos.x - 2, player.pos.z), gz = h(player.pos.x, player.pos.z + 2) - h(player.pos.x, player.pos.z - 2), n = Math.hypot(gx, gz) || 1;
  const f = Math.min(9, 2.5 + VENT.t * 2.2) * dt;
  player.pos.x -= gx / n * f; player.pos.z -= gz / n * f;
  // 6 m sous le plateau : elle est tombée
  if (player.pos.y < h(VENT.x, VENT.z) - 6) {
    VENT.t = 0; VENT.dit = false; damagePlayer(2, player.pos.x, player.pos.z);
    fadeTo(1, () => { const [x, z] = VENT.palier; player.pos.set(x, HAUT(x, z), z); player.vy = 0; player.fallFrom = player.pos.y; fadeTo(0, null);
      showMessage('La mousson t’a jetée dans le vide. Il faudrait marcher dans le vent comme Hanuman.', 4.5); });
  }
}

// ---------- le Yak (acte III, étape 6) ----------
// Le géant gardien du plus haut temple (SCENARIO.md : de faïence et de verre colorés, l'épée plantée
// devant lui), le morceau de cloche planté au front. Il est hors du temps : ses coups arrivent avant
// qu'on les voie (pas d'élan) et les nôtres le traversent. Le gong met Camille à son rythme six
// secondes : il prend son élan, et on le touche. Trois touches au morceau. Entre deux, il fige des
// paquets de pluie et les lance comme des pierres. Composé de volumes, en matières Poly Haven
// (Eugène : « très bien »), sans aplats.
const YAK = { x: 904, z: 321, porte: [904, 331], e: null, touches: 0, hpRef: 30, jets: [], jetT: 3, fini: false, statue: null };
Object.assign(KINDS, { yak: { hp: 30, speed: 3.0, dmg: 2, range: 3.8, aggro: 40, windup: 0.08, cd: 1.7, fly: 0, r: 1.5, label: 'Le Yak, gardien du grand piton', boss: true, barY: 8.6 } });
const YAK_LENT = { ...KINDS.yak, windup: 1.0, cd: 2.2, speed: 1.6 };
function faireYak() {
  const g = new THREE.Group();
  const vert = phMat('worn_tile_floor', 2, 3, { color: 0x6ac09a }), rouge = phMat('worn_tile_floor', 2, 2, { color: 0xd04a34 }), peau = phMat('worn_tile_floor', 1, 1, { color: 0x7ad0c0 });
  const or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.28 }), miroir = new THREE.MeshStandardMaterial({ color: 0xbfe0f0, metalness: 1, roughness: 0.05 });
  const blanc = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.4 }), noir = new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 0.6 });
  const add = (geo, m, x, y, z) => { const o = mesh(geo, m, x, y, z); g.add(o); return o; };
  for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(0.42, 0.5, 2.4, 10), vert, sx * 0.62, 1.2, 0); add(boxG(0.7, 0.3, 1.1), or, sx * 0.62, 0.15, 0.15); }
  add(new THREE.CylinderGeometry(1.0, 1.25, 1.3, 14), rouge, 0, 3.0, 0);                 // le pagne
  add(boxG(2.0, 2.1, 1.2), vert, 0, 4.6, 0);                                             // le buste
  { const c = add(new THREE.TorusGeometry(0.98, 0.1, 8, 24), or, 0, 3.65, 0); c.rotation.x = Math.PI / 2; }
  for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; add(new THREE.CircleGeometry(0.09, 8), miroir, Math.cos(a) * 0.7, 4.2 + (k % 3) * 0.45, 0.61).rotation.y = 0; }   // les éclats de miroir du plastron
  add(new THREE.SphereGeometry(0.5, 10, 8), vert, -1.2, 5.5, 0); add(new THREE.SphereGeometry(0.5, 10, 8), vert, 1.2, 5.5, 0);
  // les bras et l'épée : un groupe qui pivote à l'épaule (l'élan, le coup)
  const bras = new THREE.Group(); bras.position.set(0, 5.4, 0.2); g.add(bras);
  for (const sx of [-1, 1]) { const b = mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.2, 8), vert, sx * 0.9, -1.0, 0.5); b.rotation.x = -0.6; b.rotation.z = -sx * 0.25; bras.add(b); }
  const epee = new THREE.Group(); epee.position.set(0, -1.9, 1.3); bras.add(epee);
  epee.add(mesh(boxG(0.22, 3.6, 0.06), new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 0.9, roughness: 0.25 }), 0, -1.6, 0));
  epee.add(mesh(boxG(0.9, 0.16, 0.2), or, 0, 0.2, 0)); epee.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6), or, 0, 0.6, 0));
  // la tête : la face turquoise, les yeux ronds exorbités, les crocs, la couronne en flèche
  add(new THREE.SphereGeometry(0.78, 16, 12), peau, 0, 6.35, 0.05).scale.set(1, 1.05, 0.95);
  for (const sx of [-1, 1]) { add(new THREE.SphereGeometry(0.17, 10, 8), blanc, sx * 0.3, 6.5, 0.66); add(new THREE.SphereGeometry(0.08, 8, 6), noir, sx * 0.3, 6.5, 0.8);
    const c = add(new THREE.ConeGeometry(0.07, 0.3, 6), blanc, sx * 0.22, 5.9, 0.7); c.rotation.x = Math.PI; }
  add(boxG(0.5, 0.08, 0.1), rouge, 0, 6.0, 0.74);
  [[0.82, 0.3, 7.05], [0.62, 0.35, 7.35], [0.42, 0.4, 7.7], [0.24, 0.45, 8.1]].forEach(([r, h, y]) => add(new THREE.CylinderGeometry(r * 0.8, r, h, 12), or, 0, y, 0));
  add(new THREE.ConeGeometry(0.12, 0.9, 8), or, 0, 8.75, 0);
  // le morceau de la Grande Cloche, planté au front : du bronze sombre qui luit un peu
  const morceau = add(new THREE.TetrahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0x5a4a2a, metalness: 0.8, roughness: 0.35, emissive: 0x2a1a04 }), 0, 6.75, 0.72);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { anim: true, bras, epee, morceau };
  return g;
}
setMaker('yak', () => faireYak());
setAnimHook('yak', (e, dt) => {
  const u = e.mesh.userData; if (!u.bras) return true;
  // l'élan (windup) lève l'épée ; le coup la rabat ; au repos, elle pend devant lui
  const cible = e.state === 'windup' ? -1.6 : e.state === 'cool' && e.t > (e.k.cd - 0.25) ? 0.6 : 0;
  u.bras.rotation.x += (cible - u.bras.rotation.x) * Math.min(1, dt * (e.k === YAK_LENT ? 4 : 18));
  u.morceau.rotation.y += dt * 2;
  return true;
});
function yak({ addInteract }) {
  // la statue du Yak revenu à sa porte (la fin) : même corps, immobile
  YAK.statue = faireYak(); YAK.statue.visible = false; YAK.statue.userData.dynamic = true; scene.add(YAK.statue);
}
function animeYak(dt) {
  if (EN_INSTANCE || YAK.fini || !atteint3('yak') || atteint3('fete')) return;
  const d = Math.hypot(player.pos.x - YAK.x, player.pos.z - YAK.z);
  if (!YAK.e) {
    if (d > 45) return;
    YAK.e = spawnEnemy('yak', YAK.x, YAK.z, 'acte3'); YAK.e.yaw = Math.atan2(player.pos.x - YAK.x, player.pos.z - YAK.z); YAK.hpRef = YAK.e.hp; YAK.touches = 0;
    showMessage('Le Yak se tourne vers toi. Ton regard n’arrive pas à le suivre : il est déjà là où il frappe.', 5);
    return;
  }
  const e = YAK.e; if (e.dead) return;
  const lent = gongActif() && Math.hypot(GONG.x - e.pos.x, GONG.z - e.pos.z) < GONG.r + 4;
  e.k = lent ? YAK_LENT : KINDS.yak;
  // un coup reçu : au gong, une touche au morceau ; hors du gong, il le traverse
  if (e.hp < YAK.hpRef) {
    if (lent) { YAK.touches++; e.hp = 30 - 10 * YAK.touches; YAK.hpRef = e.hp; SFX.cloche && SFX.cloche(true); burst(e.pos.x, e.pos.y + 6.7, e.pos.z, 0xd8a848, 16, 4, 0.6);
      showMessage(YAK.touches < 3 ? `Le morceau de cloche vibre sous le coup ! (${YAK.touches} / 3)` : 'Le morceau de cloche se détache !', 2.5);
      if (YAK.touches >= 3) { e.hp = 0.01; e.caged = true; finYak(); } }
    else { e.hp = YAK.hpRef; if (!(YAK.dit > performance.now())) { YAK.dit = performance.now() + 4000; showMessage('Ton coup le traverse : il n’est déjà plus là. (K : le gong, pour te mettre à son rythme)', 3); } }
  }
  // les paquets de pluie figée, lancés comme des pierres, quand on est loin de son épée
  YAK.jetT -= dt;
  if (YAK.jetT <= 0 && d > 6 && d < 40 && !e.caged) {
    YAK.jetT = lent ? 5 : 3.2;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0xcfeef2, transparent: true, opacity: 0.75, roughness: 0.05 }));
    m.position.set(e.pos.x, e.pos.y + 6, e.pos.z); scene.add(m);
    const v = new THREE.Vector3(player.pos.x - e.pos.x, 0, player.pos.z - e.pos.z).normalize().multiplyScalar(lent ? 9 : 18);
    YAK.jets.push({ m, v, t: 0 });
  }
  for (let i = YAK.jets.length - 1; i >= 0; i--) { const J = YAK.jets[i]; J.t += dt;
    J.m.position.addScaledVector(J.v, dt); J.m.position.y += (player.pos.y + 1 - J.m.position.y) * Math.min(1, dt * 2);
    if (J.m.position.distanceTo(player.pos.clone().setY(player.pos.y + 1)) < 1.3) { damagePlayer(1, J.m.position.x, J.m.position.z); burst(J.m.position.x, J.m.position.y, J.m.position.z, 0xcfeef2, 14, 4, 0.5); }
    else if (J.t < 4) continue;
    scene.remove(J.m); YAK.jets.splice(i, 1); }
}
// trois touches : le morceau tombe. La fin de l'acte (étape 7) prend la suite.
function finYak() {
  YAK.fini = true; state.yakLibre = true; passer3('fete');
  for (const J of YAK.jets) scene.remove(J.m); YAK.jets.length = 0;
  setTimeout(() => { if (YAK.e) { YAK.e.dead = true; YAK.e.mesh.visible = false; YAK.e.bar.visible = false; } finActe3(); }, 1800);
}

// ---------- Ko Tapu, le clou : trop fin pour le relief (8 m à la base), on le tourne ----------
function koTapu({ scene }) {
  const pr = [[0, -6], [3.2, -6], [2.6, 0], [3.0, 4], [4.2, 9], [5.6, 14], [6.4, 19], [6.0, 23], [4.6, 26], [2.0, 27.5], [0, 28]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pr, 18); const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), y = p.getY(k), b = 1 + 0.18 * Math.sin(y * 0.9 + Math.atan2(z, x) * 3) + 0.1 * Math.sin(y * 2.3); p.setX(k, x * b); p.setZ(k, z * b * 0.8); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, phMat('paroi_rocheuse', 8, 8, { color: 0xb0a490 })); m.position.set(-684, 0, 468); m.castShadow = true; scene.add(m);
  // la touffe de jungle au sommet
  const t = new THREE.Mesh(new THREE.SphereGeometry(5.6, 10, 6, 0, TAU, 0, Math.PI / 2), phMat('forest_leaves_02', 4, 4, { color: 0x4a6a3a }));
  t.scale.set(1, 0.45, 0.8); t.position.set(-684, 27, 468); scene.add(t);
}

// ---------- le grand piton : le chedi doré du Wat Tham Suea, et ses temples ----------
function chedi({ hauteur, scene, addInteract }) {
  const x = 982.7, z = 343.9, y = hauteur(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.28 }), blanc = phMat('chaux_craquelee', 3, 3, { color: 0xf0ece0 });
  // trois terrasses blanches, la cloche dorée, les anneaux, la flèche
  [[9, 1.4], [7.4, 1.4], [6, 1.4]].forEach(([r, h], k) => g.add(mesh(new THREE.CylinderGeometry(r, r + 0.3, h, 24), blanc, 0, 0.7 + k * 1.4, 0)));
  const cl = new THREE.LatheGeometry([[0, 0], [5.4, 0], [5.6, 1], [5.2, 3.4], [4.2, 5.6], [2.6, 7.2], [1.2, 7.8], [0, 7.9]].map(([r, h]) => new THREE.Vector2(r, h)), 28);
  g.add(mesh(cl, or, 0, 4.2, 0));
  for (let k = 0; k < 7; k++) { const a = mesh(new THREE.TorusGeometry(1.25 - k * 0.12, 0.22, 6, 18), or, 0, 12.4 + k * 0.55, 0); a.rotation.x = Math.PI / 2; g.add(a); }
  g.add(mesh(new THREE.ConeGeometry(0.55, 7, 12), or, 0, 19.6, 0));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // le chedi coiffe une seconde bosse du sommet, qu'un ravin de 30 m sépare du plateau : on le
  // regarde depuis le bord du plateau, en face (parcours du 5 octobre : à son pied, on n'arrivait pas)
  addInteract({ pos: new THREE.Vector3(946, hauteur(946, 340), 340), r: 7, prompt: () => 'regarder le chedi doré', fn: () => showMessage('Le chedi du grand piton. Les clochettes de ses anneaux sont arrêtées en plein tintement.', 6) });
}

// ---------- l'escalier du grand piton ----------
// Eugène, 5 octobre : « fais l'escalier ». Le replat des moines (47 m, devant le Wat Tham Suea) et
// le plateau du sommet (114 m) sont séparés par une falaise de 67 m sur 10 : on n'y montait que par
// le câble de Phi Phi. SCENARIO.md : « escaliers de centaines de marches », comme celui du vrai
// temple de la grotte du Tigre. Le relief ne peut pas le porter (sa grille de 10 m mêlerait des
// lacets serrés, et les tuiles Copernicus ne sont pas sur le PC) : c'est un OUVRAGE, maçonné contre
// la falaise — trois volées et deux paliers qui se replient sur eux-mêmes, chacune un peu plus
// près de la paroi que la précédente (en plan, rien ne se recouvre : un sol par point suffit), puis
// un pont de 18 m jusqu'au bord du plateau. 117 m de marches pour 67 m : 30°, sous les 35° du banc.
// On y marche par solLieu (solEscalier) ; des parapets inscrits dans les collisions en font un
// couloir — on n'en tombe pas. Les parapets sont les nagas des escaliers thaïs, en écailles vertes.
const ESC = [];             // { x0, x1, z0, z1, h(x), rampe, parapets: [[côté, de, à]] }
function solEscalier(x, z) {
  if (x < 897.5 || x > 958 || z < 287.5 || z > 314.5) return null;
  for (const E of ESC) if (x >= E.x0 && x <= E.x1 && z >= E.z0 && z <= E.z1) return E.h(x);
  return null;
}
function escalier({ hauteur, inscrire, scene }) {
  const h0 = hauteur(901, 290), haut = hauteur(929, 314), s = (haut - h0) / 117;
  const F = (x0, x1, z0, z1, h, rampe, parapets) => ESC.push({ x0, x1, z0, z1, h, rampe, parapets });
  // les côtés : 's' (z0), 'n' (z1), 'o' (x0), 'e' (x1), avec la portion bordée [de, à] (null : tout le côté)
  F(904, 952, 288, 291.5, (x) => h0 + (x - 904) * s, true, [['s'], ['n']]);                       // 1re volée, vers l'est
  F(952, 957.5, 288, 295.5, () => h0 + 48 * s, false, [['s'], ['n'], ['e']]);                     // le palier est
  F(904, 952, 292, 295.5, (x) => h0 + 48 * s + (952 - x) * s, true, [['s'], ['n']]);              // 2e volée, vers l'ouest
  F(898, 904, 292, 299.5, () => h0 + 96 * s, false, [['s'], ['n'], ['o']]);                       // le palier ouest
  F(904, 925, 296, 299.5, (x) => h0 + 96 * s + (x - 904) * s, true, [['s'], ['n']]);              // 3e volée, vers l'est
  F(925, 933, 296, 314, () => haut, false, [['s'], ['e'], ['o', 299.5, 314]]);                    // le pont, jusqu'au plateau
  // les collisions : un mur de 30 cm sur chaque bord qui n'ouvre pas sur la suite du chemin
  const mur = (x0, x1, z0, z1) => inscrire([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], (x0 + x1) / 2, (z0 + z1) / 2);
  mur(904, 957.8, 287.7, 288); mur(957.5, 957.8, 288, 295.5); mur(898, 952, 291.5, 292); mur(904, 957.8, 295.5, 296);
  mur(897.7, 898, 292, 299.5); mur(898, 925, 299.5, 299.8); mur(924.7, 925, 299.5, 314); mur(933, 933.3, 296, 314);
  // la géométrie, en mètres pour les UV
  const pierre = { p: [], u: [] }, marche = { p: [], u: [] }, naga = { p: [], u: [] }, crete = { p: [], u: [] };
  const quad = (G, a, b, c, d, uv) => { G.p.push(...a, ...b, ...c, ...a, ...c, ...d); G.u.push(...uv[0], ...uv[1], ...uv[2], ...uv[0], ...uv[2], ...uv[3]); };
  // une face verticale le long de x (en z fixe) entre deux lignes de hauteur, ou le long de z (en x fixe)
  const faceX = (G, z, xa, xb, ya0, yb0, ya1, yb1) => quad(G, [xa, ya0, z], [xb, yb0, z], [xb, yb1, z], [xa, ya1, z], [[xa, ya0], [xb, yb0], [xb, yb1], [xa, ya1]]);
  const faceZ = (G, x, za, zb, y0, y1) => quad(G, [x, y0, za], [x, y0, zb], [x, y1, zb], [x, y1, za], [[za, y0], [zb, y0], [zb, y1], [za, y1]]);
  const P = 0.35, HP = 0.85;          // le parapet : 35 cm d'épais, 85 cm au-dessus des marches
  for (const E of ESC) {
    let bas = 1e9; for (const x of [E.x0, E.x1]) for (const z of [E.z0, E.z1]) bas = Math.min(bas, hauteur(x, z) - 1);
    const ya = E.h(E.x0), yb = E.h(E.x1);
    // la maçonnerie : quatre faces, du pied au dessus des marches
    faceX(pierre, E.z0, E.x0, E.x1, bas, bas, ya, yb); faceX(pierre, E.z1, E.x0, E.x1, bas, bas, ya, yb);
    faceZ(pierre, E.x0, E.z0, E.z1, bas, ya); faceZ(pierre, E.x1, E.z0, E.z1, bas, yb);
    // le dessus : des marches de 30 cm (la hauteur prise au milieu de chaque marche : on marche sur la
    // rampe, les pieds ne s'écartent pas des marches de plus de 9 cm), ou le dallage d'un palier
    if (E.rampe) {
      const n = Math.round((E.x1 - E.x0) / 0.3), w = (E.x1 - E.x0) / n;
      for (let k = 0; k < n; k++) { const xa = E.x0 + k * w, xb = xa + w, y = E.h(xa + w / 2);
        quad(marche, [xa, y, E.z0], [xa, y, E.z1], [xb, y, E.z1], [xb, y, E.z0], [[xa, E.z0], [xa, E.z1], [xb, E.z1], [xb, E.z0]]);
        if (k < n - 1) { const y2 = E.h(xb + w / 2); faceZ(marche, xb, E.z0, E.z1, Math.min(y, y2), Math.max(y, y2)); } }
    } else quad(marche, [E.x0, ya, E.z0], [E.x0, ya, E.z1], [E.x1, ya, E.z1], [E.x1, ya, E.z0], [[E.x0, E.z0], [E.x0, E.z1], [E.x1, E.z1], [E.x1, E.z0]]);
    // les parapets
    for (const [c, de, a] of E.parapets) {
      if (c === 's' || c === 'n') { const z = c === 's' ? E.z0 : E.z1, zi = c === 's' ? E.z0 + P : E.z1 - P;
        faceX(naga, z, E.x0, E.x1, ya, yb, ya + HP, yb + HP); faceX(naga, zi, E.x0, E.x1, ya - 0.2, yb - 0.2, ya + HP, yb + HP);
        quad(naga, [E.x0, ya + HP, z], [E.x1, yb + HP, z], [E.x1, yb + HP, zi], [E.x0, ya + HP, zi], [[E.x0, 0], [E.x1, 0], [E.x1, P], [E.x0, P]]);
        const zc = (z + zi) / 2; quad(crete, [E.x0, ya + HP + 0.1, zc - 0.07], [E.x1, yb + HP + 0.1, zc - 0.07], [E.x1, yb + HP + 0.1, zc + 0.07], [E.x0, ya + HP + 0.1, zc + 0.07], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        faceX(crete, zc - 0.07, E.x0, E.x1, ya + HP, yb + HP, ya + HP + 0.1, yb + HP + 0.1); faceX(crete, zc + 0.07, E.x0, E.x1, ya + HP, yb + HP, ya + HP + 0.1, yb + HP + 0.1);
      } else { const x = c === 'o' ? E.x0 : E.x1, xi = c === 'o' ? E.x0 + P : E.x1 - P, za = de ?? E.z0, zb = a ?? E.z1, y = E.h(x);
        faceZ(naga, x, za, zb, y, y + HP); faceZ(naga, xi, za, zb, y - 0.2, y + HP);
        quad(naga, [x, y + HP, za], [x, y + HP, zb], [xi, y + HP, zb], [xi, y + HP, za], [[za, 0], [zb, 0], [zb, P], [za, P]]);
        const xc = (x + xi) / 2; quad(crete, [xc - 0.07, y + HP + 0.1, za], [xc - 0.07, y + HP + 0.1, zb], [xc + 0.07, y + HP + 0.1, zb], [xc + 0.07, y + HP + 0.1, za], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        faceZ(crete, xc - 0.07, za, zb, y + HP, y + HP + 0.1); faceZ(crete, xc + 0.07, za, zb, y + HP, y + HP + 0.1); }
    }
  }
  const pose = (G, m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.u, 2)); g.computeVertexNormals();
    const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; scene.add(o); };
  pose(pierre, phMat('chaux_craquelee', 3, 3, { color: 0xf0ece0, side: THREE.DoubleSide }));
  pose(marche, phMat('worn_tile_floor', 1, 1, { color: 0xc4baa8, side: THREE.DoubleSide }));
  pose(naga, phMat('clay_roof_tiles_02', 0.8, 0.8, { color: 0x4e8a5a, side: THREE.DoubleSide }));
  // la crête dorée des nagas, sur chaque parapet : de la mer, c'est elle qui dessine l'escalier — des
  // lignes d'or qui zigzaguent jusqu'au sommet sur la maçonnerie blanche (sans elle, un pan beige muet)
  pose(crete, new THREE.MeshStandardMaterial({ color: 0xe0b050, metalness: 0.7, roughness: 0.3, emissive: 0x3a2808, side: THREE.DoubleSide }));
  // la sala du haut de l'escalier (Eugène, 5 octobre : « fais que le haut de l'escalier se voie depuis
  // la mer »). L'escalier est sur la face NORD du plateau (z croît vers le sud), côté pleine mer et
  // Ko Panyi ; de là, on n'en voyait que la maçonnerie, des pans blancs muets. Au bout du pont, un
  // pavillon ouvert comme à la tête des escaliers des temples thaïs : six colonnes blanches sur les
  // parapets, des poutres de bois laqué rouge, et le toit des temples du sommet (toitThai : deux
  // étages rouge et vert, pignons dorés, chofa). Le faîtage court d'est en ouest, en travers du pont :
  // le long, il ne montrait à la mer qu'un pignon de chant, perdu sur la maçonnerie de l'escalier ;
  // en travers, ce sont ses grands pans rouge et vert qui regardent le nord. Une flèche dorée au
  // milieu du faîtage, comme celle des chedis : elle accroche la lumière de loin.
  { const yC = haut + 6.5, col = phMat('chaux_craquelee', 1, 1, { color: 0xf4f0e6 }), laque = phMat('wood_cabinet_worn_long', 1, 1, { color: 0x9a3020 });
    for (const x of [925.2, 932.8]) for (const z of [302, 308, 313.8]) { const c = mesh(new THREE.CylinderGeometry(0.26, 0.3, yC - haut - HP, 10), col, x, haut + HP + (yC - haut - HP) / 2, z); c.castShadow = true; scene.add(c); }
    for (const x of [925.2, 932.8]) scene.add(mesh(boxG(0.4, 0.45, 13), laque, x, yC, 307.9));
    for (const z of [302, 313.8]) scene.add(mesh(boxG(8, 0.45, 0.4), laque, 929, yC, z));
    toitThai({ m: 'suea', pts: [[922, 300.5], [936, 300.5], [936, 315.5], [922, 315.5], [922, 300.5]] }, { cx: 929, cz: 308, ux: 1, uz: 0, a0: -7, a1: 7, b0: -7.5, b1: 7.5, L: 14, W: 15, haut: yC + 0.2 });
    // la flèche : posée sur le faîtage du second étage (toitThai : 1,6 m plus haut, 1,35 × la demi-largeur + 1)
    const yF = yC + 0.2 + 1.6 + (15 / 2 + 1 - 0.6) * 1.35, f = mesh(new THREE.ConeGeometry(0.75, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.28 }), 929, yF + 5.8, 308);
    f.castShadow = true; scene.add(f); }
  // les deux têtes de naga au pied de la 1re volée : le corps se relève et finit en tête dorée
  const or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.3 }), ecailles = phMat('clay_roof_tiles_02', 0.4, 0.4, { color: 0x4e8a5a });
  for (const z of [288 + P / 2, 291.5 - P / 2]) {
    const y = h0 + HP, c = new THREE.CatmullRomCurve3([new THREE.Vector3(905, y, z), new THREE.Vector3(903.6, y + 0.5, z), new THREE.Vector3(903, y + 1.5, z)]);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.2, 8), ecailles));
    const t = mesh(new THREE.ConeGeometry(0.28, 0.9, 8), or, 902.8, y + 1.9, z); t.rotation.z = 0.5; t.castShadow = true; scene.add(t);
  }
}

// ---------- les temples du grand piton : toits thaïs, chedis ----------
// OSM ne dit que l'emprise. Un bâtiment rond devient un chedi (la cloche blanche et dorée sur
// son socle) ; les autres prennent le toit des temples thaïs : deux ou trois pans superposés,
// très pentus, rouges bordés de vert, les pignons dorés et les chofa — les cornes dorées —
// aux bouts du faîtage. Les maillages sont fondus par matière, comme le reste du bâti.
const TEMPLE = { rouge: [], vert: [], or: [], blanc: [] };
// ---------- le bâti de Railay et de Ton Sai ----------
// Le vrai lieu : à Railay, des bungalows et des hôtels de un à trois niveaux, presque tous à toit à
// QUATRE pans (OSM : 42 « hipped » sur 48 toits dits) ; à Ton Sai, des compartiments serrés de deux
// ou trois niveaux, terrasse de béton à acrotère ou tôle à faible pente. monde.js coiffait tout
// d'un toit de tuiles à deux pans. Ici, le toit, et les ouvertures que monde.js ne fait pas :
// fenêtres à cadre de bois et volets, portes, rideaux de fer des boutiques.
// (5 octobre, Eugène : « oui pour les bungalows de bois ») Railay n'est plus d'enduit blanc sous la tuile —
// l'air provençal des captures — mais de planches sous la tôle : `toleRailay`, et le bardage de batiIles().
const BATI = { tuiles: [], tole: [], toleRailay: [], dalle: [], facades: [] };
// La tôle des toits : metal_plate_02 porte une carte de métal, qui en fait un métal PUR — sans rien à
// refléter, il sortait noir vu d'en haut (Ko Panyi, Railay, Ton Sai). Une tôle galvanisée ou peinte
// diffuse : on garde son grain, sa couleur et ses rayures, pas la carte de métal.
function tole(couleur, extra = {}) { const m = phMat('metal_plate_02', 1, 1, { color: couleur, roughness: 0.7, ...extra }); m.metalnessMap = null; m.metalness = 0.15; return m; }
function quad(dst, a, b, c, d) { dst.push(...a, ...b, ...c, ...a, ...c, ...d); }
function toitIle(b, { cx, cz, ux, uz, a0, a1, b0, b1, L, W, haut }) {
  if (b.m !== 'railay' && b.m !== 'phiphi') return false;
  const ac = (a0 + a1) / 2, bc = (b0 + b1) / 2;
  const P = (a, c, y) => [cx + (ac + a) * ux - (bc + c) * uz, haut + y, cz + (ac + a) * uz + (bc + c) * ux];
  BATI.facades.push({ pts: b.pts, haut, m: b.m });
  if (b.m === 'railay' || (b.toit === 'hipped')) {
    // quatre pans : le faîtage court le long du grand côté, à 0,45 de pente ; 60 cm de débord
    const o = 0.6, la = L / 2 + o, lb = W / 2 + o, hf = lb * 0.55, lf = Math.max(0, la - lb);
    const v = [P(-la, -lb, 0), P(la, -lb, 0), P(la, lb, 0), P(-la, lb, 0), P(-lf, 0, hf), P(lf, 0, hf)];
    const t = b.m === 'railay' ? BATI.toleRailay : BATI.tuiles;
    quad(t, v[0], v[4], v[5], v[1]); quad(t, v[2], v[5], v[4], v[3]);          // les deux longs pans
    t.push(...v[1], ...v[5], ...v[2], ...v[3], ...v[4], ...v[0]);                 // les deux croupes
    return true;
  }
  if (L * W > 110) {
    // la terrasse de béton et son acrotère de 90 cm
    const la = L / 2, lb = W / 2, d = BATI.dalle, e = 0.25;
    quad(d, P(-la, -lb, 0.02), P(-la, lb, 0.02), P(la, lb, 0.02), P(la, -lb, 0.02));
    for (const [p0, p1] of [[[-la, -lb], [la, -lb]], [[la, -lb], [la, lb]], [[la, lb], [-la, lb]], [[-la, lb], [-la, -lb]]]) {
      quad(d, P(p0[0], p0[1], 0), P(p1[0], p1[1], 0), P(p1[0], p1[1], 0.9), P(p0[0], p0[1], 0.9));
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, ix = -Math.sign(mx) * e * (Math.abs(mx) > 0.01), iy = -Math.sign(my) * e * (Math.abs(my) > 0.01);
      quad(d, P(p0[0] + ix, p0[1] + iy, 0.9), P(p1[0] + ix, p1[1] + iy, 0.9), P(p1[0] + ix, p1[1] + iy, 0), P(p0[0] + ix, p0[1] + iy, 0));
      quad(d, P(p0[0], p0[1], 0.9), P(p1[0], p1[1], 0.9), P(p1[0] + ix, p1[1] + iy, 0.9), P(p0[0] + ix, p0[1] + iy, 0.9));
    }
    return true;
  }
  // la tôle : un seul pan à 15 %, 50 cm de débord
  const la = L / 2 + 0.5, lb = W / 2 + 0.5;
  quad(BATI.tole, P(-la, -lb, 0), P(la, -lb, 0), P(la, lb, W * 0.15), P(-la, lb, W * 0.15));
  return true;
}
function dansP(x, z, pts) { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; }
function batiIles({ hauteur, scene }) {
  const cadres = [], vitres = [], volets = [], portes = [], rideaux = [], balcons = [], bardage = [[], [], []], boisBalcons = [];
  // une boîte posée contre le mur, sa face avant à `ep` du mur : ses cinq faces visibles (le dos est
  // contre le mur) poussées droit dans un tableau. Une BoxGeometry par boîte, convertie puis fondue,
  // coûtait 1 s au chargement pour les 9 000 boîtes de Railay et de Ton Sai (banc du 5 octobre).
  const boite = (dst, cx, y, cz, ux, uz, nx, nz, w, h, ep) => {
    if (ux * nz - uz * nx < 0) { ux = -ux; uz = -uz; }       // (u, haut, n) direct : les faces regardent dehors
    const v = (a, b, c) => [cx + ux * a + nx * c, y + b, cz + uz * a + nz * c], a = w / 2;
    const A = v(-a, 0, 0), B = v(a, 0, 0), C = v(a, h, 0), D = v(-a, h, 0), E = v(-a, 0, ep), F = v(a, 0, ep), G = v(a, h, ep), Hh = v(-a, h, ep);
    for (const [p, q, r, t] of [[E, F, G, Hh], [Hh, G, C, D], [A, B, F, E], [B, C, G, F], [A, E, Hh, D]]) dst.push(...p, ...q, ...r, ...p, ...r, ...t);
  };
  for (const F of BATI.facades) {
    const P = F.pts[0][0] === F.pts[F.pts.length - 1][0] && F.pts[0][1] === F.pts[F.pts.length - 1][1] ? F.pts.slice(0, -1) : F.pts;
    let sol = 1e9; for (const [x, z] of P) sol = Math.min(sol, hauteur(x, z));
    let solMax = -1e9; for (const [x, z] of P) solMax = Math.max(solMax, hauteur(x, z));
    if (F.sol != null) solMax = F.sol;          // sur pilotis : le plancher, pas la mer en dessous
    const niveaux = Math.max(1, Math.round((F.haut - solMax) / 3)), hN = (F.haut - solMax) / niveaux;
    // le bardage d'un bungalow de Railay : des planches à 2 cm devant le mur de monde.js (enduit
    // blanc pour toute la baie), du plancher au toit ; une teinte par maison, du bois clair au teck
    const bard = F.m === 'railay' ? bardage[Math.floor(Math.random() * 3)] : null;
    for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], L = Math.hypot(bx - ax, bz - az); if (L < 2.2) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L; let nx = uz, nz = -ux;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (dansP(mx + nx * 0.3, mz + nz * 0.3, P)) { nx = -nx; nz = -nz; }   // la normale vers dehors
      if (bard) boite(bard, mx, solMax - 0.15, mz, ux, uz, nx, nz, L + 0.04, F.haut - solMax + 0.15, 0.02);
      const n = Math.max(1, Math.floor(L / 3.2)), pas = L / n;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) * pas, cx = ax + ux * t, cz = az + uz * t, yb = Math.max(hauteur(cx, cz), solMax - 0.2);
        for (let e = 0; e < niveaux; e++) {
          const y0 = solMax + e * hN;
          if (e === 0 && F.m === 'phiphi' && L > 4) {
            // le rez-de-chaussée de Ton Sai : des boutiques, rideau de fer à demi relevé
            boite(rideaux, cx, y0, cz, ux, uz, nx, nz, pas * 0.86, 2.5, 0.06); boite(cadres, cx, y0 + 2.5, cz, ux, uz, nx, nz, pas * 0.9, 0.18, 0.1); continue;
          }
          if (e === 0 && k === Math.floor(n / 2) && i % 2 === 0) {
            boite(portes, cx, Math.max(y0, yb), cz, ux, uz, nx, nz, 1.0, 2.1, 0.07); boite(cadres, cx, Math.max(y0, yb) + 2.1, cz, ux, uz, nx, nz, 1.2, 0.12, 0.1); continue;
          }
          // la fenêtre : vitre, appui, linteau — sans volets (des volets battants faisaient la Provence)
          const ys = y0 + 0.95;
          boite(vitres, cx, ys, cz, ux, uz, nx, nz, 1.1, 1.3, 0.03);
          boite(cadres, cx, ys - 0.08, cz, ux, uz, nx, nz, 1.3, 0.08, 0.12);
          boite(cadres, cx, ys + 1.3, cz, ux, uz, nx, nz, 1.3, 0.1, 0.1);
          boite(cadres, cx, ys, cz, ux, uz, nx, nz, 0.06, 1.3, 0.06);                 // le meneau
        }
      }
      // les balcons des étages, un par façade et par niveau : une dalle d'un mètre, une lisse, des
      // barreaux — les chambres d'hôtel de Railay, les logements au-dessus des boutiques de Ton Sai
      if (L > 4.5) for (let e = 1; e < niveaux; e++) {
        const y0 = solMax + e * hN, lb = L - 1.2, dal = bard ? boisBalcons : balcons, gc = bard ? boisBalcons : volets;     // à Railay, la véranda et sa rambarde sont de bois
        boite(dal, mx, y0 - 0.12, mz, ux, uz, nx, nz, lb, 0.12, 1.0);
        boite(gc, mx + nx * 0.96, y0 + 0.95, mz + nz * 0.96, ux, uz, nx, nz, lb, 0.06, 0.06);
        for (let t = -lb / 2; t <= lb / 2 + 0.01; t += 1.1) boite(gc, mx + ux * t + nx * 0.96, y0, mz + uz * t + nz * 0.96, ux, uz, nx, nz, 0.05, 0.95, 0.05);
      }
    }
  }
  // les UV en mètres : x + z le long de la façade, y en hauteur
  const fondre = (v) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); const uv = new Float32Array(v.length / 3 * 2);
    for (let k = 0, j = 0; k < v.length; k += 3, j += 2) { uv[j] = v[k] + v[k + 2]; uv[j + 1] = v[k + 1]; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  const pose = (l, m, ombre = false) => { if (!l.length) return; const o = new THREE.Mesh(fondre(l), m); o.receiveShadow = true; o.castShadow = ombre; scene.add(o); };
  pose(cadres, phMat('hinoki_planks', 1, 1, { color: 0x8a6a4a }));
  pose(volets, phMat('metal_plate_02', 1, 1, { color: 0x4a4a46, roughness: 0.6 }));            // les garde-corps de fer peint
  pose(balcons, phMat('enduit_gris', 1, 1, { color: 0xc8c0b0 }), true);
  pose(portes, phMat('wood_cabinet_worn_long', 1, 1, { color: 0x7a5a3a }));
  pose(vitres, phMat('metal_plate_02', 1, 1, { color: 0x2a3236, roughness: 0.18, metalness: 0.6 }));
  pose(rideaux, phMat('metal_plate_02', 1, 1, { color: 0x9a9c98, roughness: 0.55 }));
  [0xb08a62, 0x8a6a4a, 0x6e5440].forEach((c, k) => pose(bardage[k], phMat('hinoki_planks', 1, 1, { color: c }), true));
  pose(boisBalcons, phMat('wood_planks', 1, 1, { color: 0x8a6a4a }), true);
  // les toits : les UV en mètres, sur le plan (la tuile suit la pente, à peu près)
  const geo = (v) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); const uv = [];
    for (let k = 0; k < v.length; k += 3) uv.push(v[k] / 2, v[k + 2] / 2); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  const toit = (v, m) => { if (!v.length) return; const o = new THREE.Mesh(geo(v), m); o.castShadow = o.receiveShadow = true; scene.add(o); };
  toit(BATI.tuiles, phMat('clay_roof_tiles', 1.2, 1.2, { color: 0x9a6a50, side: THREE.DoubleSide }));
  toit(BATI.tole, tole(0x9aa6b0, { side: THREE.DoubleSide }));
  // la tôle des bungalows : un peu rouillée, plus claire que celle de Ton Sai
  toit(BATI.toleRailay, tole(0xb8a490, { side: THREE.DoubleSide }));
  toit(BATI.dalle, phMat('enduit_gris', 2, 2, { color: 0xc8c0b0, side: THREE.DoubleSide }));
}

function toitThai(b, geo) {
  if (toitIle(b, geo)) return true;
  const { cx, cz, ux, uz, a0, a1, b0, b1, L, W, haut } = geo;
  if (b.m !== 'suea') return false;
  const ac = (a0 + a1) / 2, bc = (b0 + b1) / 2;
  const P = (a, c, y) => [cx + (ac + a) * ux - (bc + c) * uz, y, cz + (ac + a) * uz + (bc + c) * ux];
  const tri = (dst, ...v) => dst.push(...v.flat());
  // un chedi : un bâtiment rond (plus de 12 sommets, presque carré) — mais de moins de 40 m. Le 6 octobre
  // (Eugène : « rends le dôme en temple »), l'enclos du Wat Tham Suea lui-même (60 × 54 m, 13 sommets)
  // passait pour un chedi : un dôme blanc de 48 m sur le replat, juste devant l'escalier, qui le cachait à
  // la mer du nord. Le vrai chedi du sommet (Phra Chedi Khiri) fait 30 m.
  if (b.pts.length > 12 && Math.max(L, W) / Math.min(L, W) < 1.25 && Math.min(L, W) < 40) {
    // un chedi : la cloche, les anneaux, la flèche (même profil que celui du sommet)
    const r = Math.min(L, W) / 2 * 0.9, g = new THREE.LatheGeometry([[0, 0], [r, 0], [r * 1.02, r * 0.18], [r * 0.95, r * 0.62], [r * 0.76, r * 1.0], [r * 0.48, r * 1.3], [r * 0.22, r * 1.42], [0, r * 1.45]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
    g.translate(cx, haut, cz); TEMPLE.blanc.push(g.toNonIndexed());
    const fl = new THREE.ConeGeometry(r * 0.16, r * 1.6, 10); fl.translate(cx, haut + r * 1.45 + r * 0.8, cz); TEMPLE.or.push(fl.toNonIndexed());
    return true;
  }
  // les étages du toit : chacun plus court, posé un peu plus haut que le précédent. Un très grand temple
  // (plus de 30 m de large : l'enclos du Wat Tham Suea) prend une pente de 0,55 et non 1,35 — à 1,35,
  // son toit montait de 38 m et refaisait le mur que le dôme faisait devant l'escalier
  const n = L > 18 ? 3 : 2, pente = W > 30 ? 0.55 : 1.35;
  for (let k = 0; k < n; k++) {
    const la = L / 2 + 1.2 - k * L * 0.14, lb = W / 2 + 1.0 - k * 0.6, y0 = haut + k * 1.6, hf = lb * pente;
    const v = [P(-la, -lb, y0), P(la, -lb, y0), P(la, 0, y0 + hf), P(-la, 0, y0 + hf), P(-la, lb, y0), P(la, lb, y0)];
    const dst = k === 0 ? TEMPLE.vert : TEMPLE.rouge;
    tri(dst, v[0], v[1], v[2]); tri(dst, v[0], v[2], v[3]); tri(dst, v[4], v[3], v[2]); tri(dst, v[4], v[2], v[5]);
    if (k === n - 1) {
      tri(TEMPLE.or, v[0], v[3], v[4]); tri(TEMPLE.or, v[1], v[5], v[2]);             // les pignons dorés
      for (const s of [-1, 1]) { const c = new THREE.ConeGeometry(0.22, 2.2, 6); c.rotateZ(-s * 0.5); const q = P(s * la, 0, y0 + hf); c.translate(q[0], q[1] + 0.9, q[2]); TEMPLE.or.push(c.toNonIndexed()); }
    }
  }
  return true;
}
function templesThai({ scene }) {
  const geo = (v) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    const p = g.attributes.position, uv = []; for (let k = 0; k < p.count; k++) uv.push(p.getX(k) + p.getZ(k), p.getY(k)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; };
  const fondre = (l) => mergeGeometries(l.map((g) => { if (!g.attributes.uv) { const p = g.attributes.position, uv = []; for (let k = 0; k < p.count; k++) uv.push(p.getX(k) + p.getZ(k), p.getY(k)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); } for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; }));
  const tuiles = (c) => phMat('clay_roof_tiles_02', 1, 1, { color: c, side: THREE.DoubleSide });
  for (const [v, m] of [[TEMPLE.rouge, tuiles(0xc04a2a)], [TEMPLE.vert, tuiles(0x5a9a5a)]]) if (v.length) { const x = new THREE.Mesh(geo(v), m); x.castShadow = x.receiveShadow = true; scene.add(x); }
  const or = new THREE.MeshStandardMaterial({ color: 0xd8a848, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
  const pignons = [], autres = []; for (const g of TEMPLE.or) (Array.isArray(g) || typeof g === 'number' ? pignons : autres).push(g);
  if (pignons.length) scene.add(new THREE.Mesh(geo(pignons), or));
  if (autres.length) scene.add(new THREE.Mesh(fondre(autres), or));
  if (TEMPLE.blanc.length) { const x = new THREE.Mesh(fondre(TEMPLE.blanc), phMat('chaux_craquelee', 3, 3, { color: 0xf2eee4 })); x.castShadow = true; scene.add(x); }
}

// ---------- le marché flottant de Ko Panyi ----------
// SCENARIO.md § 12 : les passeurs vivent sur l'eau, « au marché flottant : barques chargées
// de fruits, de riz, de fleurs, qu'on enjambe d'une à l'autre ». Il remplit le bassin abrité
// que les passerelles de Ko Panyi enferment au sud du ponton (x 75–125, z 22–60) : deux files
// de barques bord à bord, qui relient la passerelle du nord à celle du sud. On y marche
// (solLieu) ; la mer, elle, bouge encore — les barques tanguent un peu.
const MARCHE = [];        // { x, z, rot, L, W }
let HAUT = null;
function solMarche(x, z) {
  for (const b of MARCHE) {
    const dx = x - b.x, dz = z - b.z, c = Math.cos(b.rot), s = Math.sin(b.rot);
    const long = dx * s + dz * c, trav = dx * c - dz * s;          // la barque a sa longueur sur son z local
    if (Math.abs(long) < b.L / 2 && Math.abs(trav) < b.W / 2) return Math.max(0.55, HAUT ? HAUT(x, z) : 0);
  }
  return null;
}
function marche({ hauteur, addInteract }) {
  HAUT = hauteur;
  const bois = phMat('wood_planks', 1.2, 1.2, { color: 0x8a6a48 }), coques = [], fruits = { jaune: [], orange: [], rose: [], vert: [], blanc: [] }, paniers = [], baches = [], perches = [];
  const COUL = { jaune: 0xe8c040, orange: 0xe07820, rose: 0xd84878, vert: 0x6aa040, blanc: 0xf2eee0 };
  for (const x of [92, 100.4]) for (let k = 0; k < 20; k++) {
    const z = 21.5 + k * 2.0 + rand(-0.08, 0.08), rot = Math.PI / 2 + rand(-0.04, 0.04);
    // le rectangle où l’on marche déborde un peu la coque : entre deux barques bord à bord, pas de fente où tomber
    const b = { x, z, rot, L: 8.7, W: 2.3 }; MARCHE.push(b);
    // la coque : un fuseau de bois, le pont à 0,5 m au-dessus de l'eau
    const h = new THREE.LatheGeometry([[0, -0.35], [0.7, -0.3], [0.95, 0.15], [1.0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
    h.scale(1, 1, 4.2); h.rotateY(rot); h.translate(x, 0, z); coques.push(h.toNonIndexed());
    // le plancher : sans lui, la coque ouverte montrait la mer à l'intérieur, comme une barque coulée
    const pl = new THREE.BoxGeometry(1.75, 0.08, 7.4); pl.rotateY(rot); pl.translate(x, 0.47, z); coques.push(pl.toNonIndexed());
    // le chargement : deux paniers d'osier pleins de fruits ou de fleurs, posés aux bouts
    for (const bout of [-2.2, 2.2]) { if (Math.random() < 0.25) continue;
      const px = x + Math.sin(rot) * bout, pz = z + Math.cos(rot) * bout;
      const p = new THREE.CylinderGeometry(0.42, 0.32, 0.32, 10, 1, true); p.translate(px, 0.7, pz); paniers.push(p.toNonIndexed());
      const sorte = ['jaune', 'orange', 'rose', 'vert', 'blanc'][Math.floor(Math.random() * 5)];
      for (let f = 0; f < 7; f++) { const g = new THREE.SphereGeometry(sorte === 'blanc' ? 0.07 : 0.11, 6, 4); g.translate(px + rand(-0.25, 0.25), 0.86 + rand(0, 0.08), pz + rand(-0.25, 0.25)); fruits[sorte].push(g.toNonIndexed()); } }
    // une barque sur trois a sa bâche contre la pluie (arrêtée, elle aussi, au-dessus)
    if (k % 3 === 1) { const t = new THREE.PlaneGeometry(2.6, 2.2); t.rotateX(-Math.PI / 2 + 0.12); t.rotateY(rot); t.translate(x, 2.3, z); baches.push(t);
      for (const [a, c] of [[-1.1, -0.9], [1.1, -0.9], [-1.1, 0.9], [1.1, 0.9]]) { const p = new THREE.CylinderGeometry(0.03, 0.03, 1.9, 5); p.translate(x + c * Math.cos(rot) + a * Math.sin(rot), 1.4, z - c * Math.sin(rot) + a * Math.cos(rot)); perches.push(p.toNonIndexed()); } }
  }
  const ajoute = (l, m, ombre = true) => { if (!l.length) return null; const g = mergeGeometries(l.map((x) => { for (const k of Object.keys(x.attributes)) if (!['position', 'normal'].includes(k)) x.deleteAttribute(k); x.computeVertexNormals(); return x; }));
    const p = g.attributes.position, uv = []; for (let k = 0; k < p.count; k++) uv.push(p.getX(k) + p.getZ(k), p.getY(k) * 2); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const o = new THREE.Mesh(g, m); o.castShadow = ombre; o.receiveShadow = true; scene.add(o); return o; };
  MARCHE.coques = ajoute(coques, bois);
  ajoute(paniers, phMat('dry_branches_01', 1, 1, { color: 0xc8a060, side: THREE.DoubleSide }));
  for (const [k, l] of Object.entries(fruits)) ajoute(l, new THREE.MeshStandardMaterial({ color: COUL[k], roughness: 0.55 }), false);
  ajoute(baches, phMat('fabric_pattern_07', 2, 2, { color: 0x3a6aa0, side: THREE.DoubleSide }));
  ajoute(perches, bois);
  // les marchandes et les passeurs du marché, dans leurs barques : eux ne sont pas figés — ils
  // vivent sur l'eau, où le temps passe encore. Ce sont les gens à qui l'on parle dans ce monde
  // (SCENARIO.md § 12). Des rôles de la baie (4 octobre) : les villageois de Lille portaient une
  // lanterne, une hache, une coiffe flamande.
  MARCHANDES.forEach(({ col, k, role, haut, qui, dit }) => {
    const b = MARCHE[col * 20 + k], v = gensDeLeau(role, haut); if (!v) return;
    v.position.set(b.x + rand(-1.2, 1.2), 0.5, b.z); v.rotation.y = rand(0, TAU); scene.add(v);
    addInteract({ pos: v.position, r: 3, prompt: () => 'parler ' + (qui === 'Le marchand' ? 'au marchand' : 'à la marchande'), fn: () => dialogue(dit().map((text) => ({ who: qui, text }))) });
  });
}
// une femme de la baie : le rôle de Nok, recoloré, sous le chapeau conique de feuilles ; un
// homme : le vieux pêcheur, recoloré (il a son chapeau de paille)
const CHAPEAU = () => { const g = new THREE.Group(); g.add(mesh(new THREE.ConeGeometry(0.26, 0.13, 14, 1, true), phMat('dry_branches_01', 1, 1, { color: 0xd8c08a, side: THREE.DoubleSide }), 0, 0, 0)); return g; };
function gensDeLeau(role, haut) {
  const v = PNJ.buildRole(role, haut); if (!v) return null;
  if (role === 'nok') PNJ.socket(v, v.userData.perso, 'Head', CHAPEAU(), [0.027, 0.2, -0.055]);
  VENDEURS.push(v); return v;
}
// Ce qu'ils disent : court, en habitants, et ça mène quelque part (le passeur, Nok, le câble).
const MARCHANDES = [
  { col: 0, k: 2, role: 'nok', haut: 0xc0503a, qui: 'La marchande', dit: () => ['Des mangues, du riz gluant, des fleurs de lotus !', 'Sur l’eau, le temps passe encore. Alors on vend.'] },
  { col: 1, k: 5, role: 'nok', haut: 0x3a7a5a, qui: 'La marchande', dit: () => ['Tu veux aller sur une autre île ? Somsak attend au ponton, au bout du marché.', 'Il est vieux, mais il connaît toutes les passes.'] },
  { col: 0, k: 8, role: 'nok', haut: 0xd8a040, qui: 'La marchande', dit: () => state.gongThai
    ? ['Tu as le gong de Nok ! Frappe-le près des moines de Ton Sai.', 'Ils finiront leurs phrases. Un peu.']
    : ['Là-haut, devant l’arche de pierre, il y a la petite Nok.', 'C’est la seule qui bouge encore sur l’île. Va la voir.'] },
  { col: 1, k: 11, role: 'pecheur', haut: 0x5a6a8a, qui: 'Le marchand', dit: () => ['Ce câble descend du grand piton jusqu’à nos barques.', 'Les moines y faisaient passer le riz. Maintenant, plus personne.'] },
  { col: 0, k: 12, role: 'nok', haut: 0x8a4a7a, qui: 'La marchande', dit: () => ['Marche doucement, d’une barque à l’autre. Elles bougent.', 'Nous aussi, on bouge. Les îles, non.'] },
];
const VENDEURS = [];

// ---------- la tyrolienne ----------
// SCENARIO.md § 12 : les moines font passer leurs vivres d'un sommet à l'autre sur des câbles,
// avec une poulie. LA règle, tenue par la machine : on ne glisse que vers le BAS — un câble
// dont l'arrivée n'est pas plus basse que le départ n'est pas posé. Le grand piton s'atteint
// ainsi depuis le belvédère des moines de Phi Phi (aucun passeur n'y accoste, dans l'histoire), et
// de lui un câble immense plonge jusqu'au marché flottant. (La poulie du moine cuisinier viendra
// avec le cloître ; d'ici là, la tyrolienne est libre.)
// Les îles resserrées (4 octobre) : les anciens départs, le belvédère 2 de Phi Phi et celui de
// Railay, sont hors des cœurs. Phi Phi part du haut de l'escalier des moines (extraire-thailande.py,
// ESCALIER) ; Railay, du haut du sentier qui monte au sud du village.
// Le 5 octobre, le parcours au banc (une recherche de chemin depuis le départ) : l'arrivée en
// (976, 322) était à mi-falaise (74 m, une pente de 4,8 m par mètre) et le départ vers le marché au
// bord du plateau — le sommet, ses balayeurs et la clé du cloître ne s'atteignaient qu'en grimpant
// la paroi. Les deux sont sur le plateau (110–119 m) ; l'arrivée au nord, pour que la corde passe
// à 49 m du second chedi (Phra Chedi Khiri, (997, 383)) au lieu de le traverser.
const CABLES = [
  { nom: 'vers le grand piton', de: [2605, 1790], a: [915, 362] },          // le belvédère des moines, Phi Phi (~131 m) → le nord du plateau du sommet (~113 m)
  { nom: 'vers le marché flottant', de: [948, 322], a: [96, 32] },          // le plateau, au sud de la cour du puits (~112 m) → les barques de Ko Panyi
  { nom: 'vers la plage de Railay', de: [-587, 1920], a: [-650, 1534] },     // le haut du sentier de Railay (51 m) → Ao Rai Le
];
const PENDU = 2.1;            // de la poulie aux pieds de Camille
let GLISSE = null;
function cablePoint(c, t) {
  // une chaînette approchée : la corde, et une flèche de 2 % de la portée au milieu
  return new THREE.Vector3(c.p0.x + (c.p1.x - c.p0.x) * t, c.p0.y + (c.p1.y - c.p0.y) * t - c.fleche * 4 * t * (1 - t), c.p0.z + (c.p1.z - c.p0.z) * t);
}
function tyroliennes({ hauteur, addInteract }) {
  const acier = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, metalness: 0.7, roughness: 0.45 }), bois = phMat('tree_trunk', 1, 1, { color: 0x6a5038 });
  for (const c of CABLES) {
    const y0 = hauteur(...c.de), y1 = Math.max(hauteur(...c.a), 0.55);
    if (!(y1 < y0 - 2)) { console.warn('tyrolienne refusée (elle monterait) :', c.nom); continue; }       // la règle
    c.p0 = new THREE.Vector3(c.de[0], y0 + 4.2, c.de[1]); c.p1 = new THREE.Vector3(c.a[0], y1 + 3.6, c.a[1]);
    c.long = c.p0.distanceTo(c.p1); c.fleche = c.long * 0.02;
    c.p0.y += c.fleche * 0.3;                     // que la corde ne frôle pas la crête au départ
    const pts = []; for (let k = 0; k <= 60; k++) pts.push(cablePoint(c, k / 60));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.05, 5), acier));
    // les deux potences : un poteau, une traverse, le câble y est noué
    for (const [p, y] of [[c.p0, y0], [c.p1, y1]]) {
      const g = new THREE.Group(); g.position.set(p.x, y, p.z); g.rotation.y = Math.atan2(c.p1.x - c.p0.x, c.p1.z - c.p0.z); scene.add(g);
      g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, p.y - y + 0.6, 7), bois, 0, (p.y - y + 0.6) / 2, 0));
      g.add(mesh(boxG(1.6, 0.18, 0.18), bois, 0, p.y - y, 0));
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    c.duree = Math.min(28, Math.max(7, c.long / 55));
    addInteract({ pos: new THREE.Vector3(c.de[0], y0, c.de[1]), r: 4, prompt: () => 's’accrocher au câble — ' + c.nom, fn: () => glisser(c) });
  }
}
function glisser(c) {
  if (GLISSE) return;
  if (!EN_INSTANCE && !state.poulie) return showMessage('Un câble, et rien pour s’y accrocher. Les moines avaient une poulie.', 3.5);
  if (!EN_INSTANCE && c.nom === 'vers le grand piton' && !state.masqueHanuman) return showMessage('La mousson te plaque contre la potence. Impossible de passer la sangle dans ce vent.', 4);
  GLISSE = { c, t: 0 };
  player.yaw = Math.atan2(c.p1.x - c.p0.x, c.p1.z - c.p0.z); G.camYaw = player.yaw;
  showMessage('Tu passes la sangle dans la poulie des moines, et tu te laisses aller…', 3);
  SFX.roll && SFX.roll();
}
function animeGlisse(dt) {
  if (!GLISSE) return;
  const g = GLISSE; g.t = Math.min(1, g.t + dt / g.c.duree);
  // la poulie part doucement, file au milieu, freine au bout (sinon on s'écrase sur la potence)
  const s = g.t * g.t * (3 - 2 * g.t);
  const q = cablePoint(g.c, Math.min(1, Math.max(0, s)));
  player.pos.set(q.x, q.y - PENDU, q.z); player.vy = 0; player.fallFrom = player.pos.y;
  if (g.t >= 1) {
    const [x, z] = g.c.a, y = HAUT ? HAUT(x, z) : 0; player.pos.set(x, Math.max(y, 0.55), z); player.fallFrom = player.pos.y; player.vy = 0;
    if (g.c.nom === 'vers le grand piton' && state.masqueHanuman) passer3('yak');
    GLISSE = null; showMessage('Les pieds touchent. ' + g.c.nom.replace('vers ', '').replace(/^./, (l) => l.toUpperCase()) + '.', 3);
  }
}

// ---------- Nok, le gong, les moines figés ----------
// SCENARIO.md § 12 : sur les îles, tout s'est arrêté au milieu d'un geste et d'une phrase ;
// seule Nok bouge encore — elle frappait le gong du temple quand le temps s'est arrêté. Elle
// donne le gong : K le frappe, et le temps repart six secondes autour de Camille (la pluie
// tombe, les moines finissent leur geste et leur phrase). L'enquête du cloître est celle du
// scénario : trois moines, chacun un bout de phrase, puis trois balayeurs dans la cour du
// puits — un seul a quelque chose dans la manche gauche. Le cloître, provisoirement, est le
// grand piton, faute d'avoir encore bâti l'île du cloître.
const GONG = { fin: -1, r: 16 };
const FIGES = [];        // { g, x, z, texte, fini, cle, mauvais }
let NOK = null;
const gongActif = () => performance.now() < GONG.fin;
// après le Yak (étape 7), le temps est rendu à toute la baie : la pluie tombe, les figés reprennent
const tempsRendu = () => !EN_INSTANCE && atteint3('fete');
function frapperGong() {
  if (!state.gongThai || gongActif()) return;
  SFX.gong(); GONG.fin = performance.now() + 6000; GONG.x = player.pos.x; GONG.z = player.pos.z;
  showMessage('Le gong résonne. Autour de toi, le temps repart.', 3);
  gongCascade();
}
function poserLibre(bloque, hauteur, x0, z0) {
  for (let r = 0; r < 30; r += 1) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    if (!bloque(x, z, 0.8) && hauteur(x, z) > 1) return [x, z]; }
  return [x0, z0];
}
function balai() {
  const g = new THREE.Group(), bois = new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.9 });
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), bois, 0, -0.5, 0));
  g.add(mesh(new THREE.ConeGeometry(0.14, 0.4, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xb89a5a, roughness: 1, side: THREE.DoubleSide }), 0, -1.25, 0));
  return g;
}
function cle() { const g = new THREE.Group(), or = new THREE.MeshStandardMaterial({ color: 0xd8b050, metalness: 0.9, roughness: 0.25, emissive: 0x3a2a08 });
  g.add(mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), or, 0, 0.05, 0)); g.add(mesh(boxG(0.012, 0.1, 0.012), or, 0, -0.02, 0)); return g; }
function figer(role, x, z, yaw, texte, extra = {}) {
  const g = PNJ.buildRole(role, extra.haut ?? null); if (!g) return null;
  g.position.set(x, 0, z); g.rotation.y = yaw; scene.add(g);
  const F = { g, x, z, texte, t0: rand(0.3, 2.5), pose: false, ...extra };
  if (role === 'balayeur') PNJ.socket(g, g.userData.perso, 'hand_r', balai(), [0, 0.05, 0.02], [0.3, 0, 0]);
  if (extra.cle) { F.objetCle = cle(); PNJ.socket(g, g.userData.perso, 'hand_l', F.objetCle, [0, 0.12, 0.03], [0, 0, 0]); }
  FIGES.push(F); return F;
}
// le point de chemin (OSM) le plus proche, à 25 m au plus : un passant posé « à peu près là » finissait
// dans une cour fermée ou au milieu des fourrés (le parcours du 5 octobre : deux figés de Railay
// hors d'atteinte). À la même hauteur seulement : un moine du plateau ne descend pas au pied de la falaise.
function surChemin(PLAN, hauteur, x0, z0) {
  let b = [x0, z0], d = 25; const h0 = hauteur(x0, z0);
  for (const c of [...PLAN.chemins, ...PLAN.routes]) for (const [x, z] of c.pts) { const e = Math.hypot(x - x0, z - z0); if (e < d && Math.abs(hauteur(x, z) - h0) < 4) { d = e; b = [x, z]; } }
  return b;
}
function habitants({ hauteur, bloque, addInteract, PLAN }) {
  // Nok, devant la grotte de la porte, au pied du rocher de Ko Panyi
  { const [x, z] = poserLibre(bloque, hauteur, 70, -62);
    NOK = PNJ.buildRole('nok');
    if (NOK) { NOK.position.set(x, hauteur(x, z), z); NOK.rotation.y = Math.atan2(104 - x, 10 - z); scene.add(NOK);
      addInteract({ pos: new THREE.Vector3(x, hauteur(x, z), z), r: 3.5, prompt: () => 'parler à Nok', fn: parlerNok }); } }
  // les trois moines de l'enquête, au haut de l'escalier des moines de Ton Sai, et les balayeurs de
  // la cour du puits, devant la porte du cloître (ils étaient au grand piton jusqu'au 6 octobre)
  const M = [
    [2604, 1786, '« …la clé du cloître, c’est le balayeur qui l’avait… »', 'balayeur'],
    [2599, 1771, '« …Somchai balaie toujours la cour du puits… »', 'somchai'],
    [2610, 1762, '« …il cache la clé dans sa manche gauche… »', 'manche'],
  ];
  for (const [ax, az, texte, indice] of M) { const [x, z] = poserLibre(bloque, hauteur, ax, az); figer('moine', x, z, rand(0, TAU), texte, { indice }); }
  const B = [[2598, 1749, false], [2607, 1750, true], [2611, 1738, false]];
  for (const [ax, az, bon] of B) { const [x, z] = poserLibre(bloque, hauteur, ax, az); figer('balayeur', x, z, rand(0, TAU), null, { cle: bon && !state.cleCloitre, balayeur: true, bon }); }
  // le moine cuisinier, figé au-dessus de sa marmite : le gong lui fait finir son geste
  { const F = figer('moine', 2618.2, 1710.2, 2.4, '« On ne monte pas mille marches pour les redescendre à pied. »', { cuisinier: true, qui: 'Le moine', desc: 'Un moine figé au-dessus de sa marmite, la louche levée.' }); }
  // les habitants des îles, figés comme les moines au milieu d'un geste et d'une phrase : le gong
  // la leur fait finir. Ce qu'ils disaient mène quelque part (un quai, un câble, un temple).
  for (const [role, haut, ax, az, desc, texte, enfant] of HABITANTS) { const [x, z] = poserLibre(bloque, hauteur, ...surChemin(PLAN, hauteur, ax, az));
    figer(role, x, z, rand(0, TAU), texte, { haut, desc, enfant, qui: enfant ? 'L’enfant' : role === 'nok' ? 'La femme' : haut == null ? 'Le moine' : 'L’homme' }); }
  for (const F of FIGES) { F.g.position.y = hauteur(F.x, F.z);
    addInteract({ pos: F.g.position, r: 3, prompt: () => F.balayeur ? 'regarder le balayeur' : F.desc ? 'regarder ' + ({ 'La femme': 'la femme figée', 'L’enfant': 'l’enfant figé', 'Le moine': 'le moine figé' }[F.qui] || 'l’homme figé') : 'écouter le moine', fn: () => parlerFige(F) }); }
  if (state.gongThai) AIDE.extra.push(['K', 'frapper le gong']);
  TOUCHES.KeyK = frapperGong;
}
const HABITANTS = [
  ['moine', 0x3a5a7a, -95, -50, 'Un homme figé devant la mosquée, la main tendue vers la mer.', '« …les passeurs ? Ils vivent sur l’eau, maintenant. Ils n’osent plus accoster… »'],
  ['nok', 0xb04a3a, -578, 1627, 'Une femme figée sur le seuil de sa boutique, un sac de riz sur l’épaule.', '« …les barques accostent à la plage de l’ouest, au ponton… »'],
  ['moine', 0x6a5a3a, -572, 1845, 'Un homme figé au pied du sentier, le pied levé sur une marche.', '« …ce sentier monte jusqu’au câble des moines, au-dessus du village… »'],
  ['nok', 0x3a7a8a, 2320, 1830, 'Une femme figée au milieu de la rue, un panier de noix de coco dans les bras.', '« …l’escalier des moines, derrière le village, tout en haut de la colline… »'],
  ['moine', 0x7a3a3a, 2205, 1905, 'Un homme figé près du ponton, une corde à la main.', '« …de là-haut, on voit toutes les îles de la baie… »'],
  // le 5 octobre : les enfants de Ko Panyi, un moine à chaque bout de câble, une vendeuse devant
  // Ko Tapu. Des gens de passage : ils disent le lieu, ou mènent quelque part ; aucun secret.
  ['enfant', 0xd8b040, 66, 44, 'Un enfant figé au bord de la passerelle, les bras en l’air, prêt à sauter dans l’eau.', '« …le dernier dans l’eau a perdu !… »', true],
  ['enfante', 0x5a7aa0, -186, -52, 'Un enfant figé devant l’école, les mains sur les yeux.', '« …quatre-vingt-dix-huit, quatre-vingt-dix-neuf, cent ! J’arrive !… »', true],
  ['nok', 0xc06a3a, -676, 562, 'Une vendeuse figée sur la grève, un collier de coquillages tendu vers le large.', '« …Ko Tapu, le clou ! Un jour, la mer le fera tomber, mais pas aujourd’hui… »'],
  ['moine', null, 944, 327, 'Un moine figé près du câble, une corbeille de riz à ses pieds.', '« …le câble descend jusqu’au marché flottant. On n’y monte jamais : on ne fait que descendre… »'],
  ['moine', null, 2596, 1796, 'Un moine figé au bout de l’escalier, la main sur la poulie.', '« …accroche-toi bien : le câble porte jusqu’au grand piton… »'],
];
function parlerNok() {
  if (!state.gongThai) dialogue([
    { who: 'Nok', text: 'Tu bouges ! Toi aussi, tu bouges !' },
    { who: 'Nok', text: 'Je frappais le gong du temple quand tout s’est arrêté. La pluie, les moines, les clochettes. Moi, je suis restée.' },
    { who: 'Nok', text: 'Les passeurs ont peur d’accoster. Ils disent que les îles mangent le temps. Ils ne se parlent même plus : chacun reste à son ponton.' },
    { who: 'Nok', text: 'Prends le petit gong. Frappe-le près de ce qui est figé : ça repart, un peu. Pas longtemps.' },
    { text: 'Nok te donne le petit gong du temple. (K : frapper le gong)', fn: () => { state.gongThai = true; AIDE.extra.push(['K', 'frapper le gong']); SFX.gong(); } },
    { who: 'Nok', text: 'Somsak, le vieux passeur, conduisait les moines chaque matin. **Il va encore à Ton Sai**, si on le paie.', fn: () => noter3('somsak') },
  ]);
  else if (atteint3('fete')) dialogue([{ who: 'Nok', text: 'Ce que tu as commencé…' }, { text: 'Elle ne finit pas sa phrase. Elle te regarde, et sourit quand même.' }]);
  else dialogue([{ who: 'Nok', text: state.cleCloitre ? 'La clé du cloître ! Les moines vont bien ?' : 'Frappe le gong près des moines de Ton Sai. Ils finiront leurs phrases.' }]);
}
function parlerFige(F) {
  const vivant = tempsRendu() || (gongActif() && Math.hypot(F.x - GONG.x, F.z - GONG.z) < GONG.r);
  if (!F.balayeur) {
    if (!vivant) return showMessage((F.desc || 'Le moine est figé, la bouche ouverte, au milieu d’un mot.') + (state.gongThai ? ' (K : le gong)' : ''), 3.5);
    if (F.cuisinier) {
      F.fini = true;
      if (state.poulie) return showMessage('Le moine cuisinier remue sa marmite. « Bon appétit, là-haut. »', 4);
      state.poulie = true; SFX.pickup && SFX.pickup();
      dialogue([{ who: 'Le moine cuisinier', text: 'La louche retombe dans la marmite. Il te regarde, surpris.' },
        { who: 'Le moine cuisinier', text: 'On ne monte pas mille marches pour les redescendre à pied. Tiens : **la poulie des moines**. Le câble part du belvédère.', fn: finCloitre }]);
      return;
    }
    F.fini = true; if (F.indice) noter3(F.indice); return showMessage((F.qui || 'Le moine') + ' finit sa phrase : ' + F.texte, 6);
  }
  if (!vivant) return showMessage('Un moine figé, le balai levé. Sa manche ' + (F.bon && !state.cleCloitre ? 'gauche est pliée bizarrement.' : 'pend, toute droite.'), 3.5);
  if (F.bon && !state.cleCloitre) {
    state.cleCloitre = true; if (F.objetCle) F.objetCle.visible = false; SFX.dizaine();
    return showMessage('Le balai repart, la manche se déplie : une clé tombe sur les dalles. La clé du cloître !', 6);
  }
  showMessage('Le balai repart, deux coups sur les dalles… rien ne tombe de ses manches.', 4);
}
function animeHabitants(dt) {
  if (NOK && NOK.userData.ctrl) PNJ.animeVillageois(NOK, dt, false);
  const actif = gongActif();
  for (const F of FIGES) { const c = F.g.userData.ctrl; if (!c) continue;
    // figé : la pose d'un instant choisi au hasard, une fois pour toutes ; le gong le relance
    if (!F.pose) { c.jouer(F.g.userData.idle, 0); c.update(F.t0); F.pose = true; }
    else if (tempsRendu() || (actif && Math.hypot(F.x - GONG.x, F.z - GONG.z) < GONG.r)) c.update(dt); }
  if (actif || tempsRendu()) PLUIE.chute = (PLUIE.chute + dt * 9) % PLUIE.pas;
}

// ---------- la garde : là où l'on ne passe plus ----------
// Les îles sont ramenées à leur cœur (extraire-thailande.py, COEURS : PLAN.morceaux[m].coeur). Le
// reste de l'île est une falaise (le relief la dresse à BORD() du cœur) ou de la jungle ; on y
// bloque le passage à BORD() + 3 m — au pied de la falaise, pas avant, que la rue coupée y mène.
// Posé APRÈS la jungle, qui évite ce qui est bloqué : la garde garde ses arbres.
const BORD = (x, z) => 8 + 4 * (Math.sin(x / 23) + Math.sin(z / 17 + 1.3));     // la même que bord_coeur(), recolter-relief-thailande.py
function garde({ hauteur, inscrire, PLAN }) {
  const pas = 4;
  for (const M of Object.values(PLAN.morceaux || {})) {
    if (!M.coeur || M.mode === 'ile') continue;          // le grand piton : la mer fait la limite
    const [cx0, cx1, cz0, cz1] = M.coeur;
    const hors = (x, z) => Math.hypot(Math.max(cx0 - x, 0, x - cx1), Math.max(cz0 - z, 0, z - cz1)) > BORD(x, z) + 3 && hauteur(x, z) > 0.2;
    // par rangées de 4 m, les cases bloquées bout à bout ne font qu'un rectangle
    for (let z = M.z0; z < M.z1; z += pas) {
      let debut = null;
      for (let x = M.x0; x <= M.x1; x += pas) {
        const b = x < M.x1 && hors(x + pas / 2, z + pas / 2);
        if (b && debut === null) debut = x;
        if (!b && debut !== null) { inscrire([[debut, z], [x, z], [x, z + pas], [debut, z + pas]], (debut + x) / 2, z + pas / 2); debut = null; }
      }
    }
  }
}

// ---------- la pluie suspendue ----------
// Des gouttes immobiles autour de Camille : un pavé de 40 m répété en 3 × 3 × 2, recalé tous
// les 40 m — la même goutte reste au même endroit du monde, elle ne suit pas Camille.
const PLUIE = { tuiles: [], pas: 40, chute: 0 };
function pluie({ scene }) {
  const v = [], N = 900;
  for (let k = 0; k < N; k++) { const x = Math.random() * 40, y = Math.random() * 40, z = Math.random() * 40, l = rand(0.25, 0.5); v.push(x, y, z, x, y - l, z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const m = new THREE.LineBasicMaterial({ color: 0xd8e4f0, transparent: true, opacity: 0.4, depthWrite: false });
  for (let k = 0; k < 18; k++) { const l = new THREE.LineSegments(g, m); l.frustumCulled = false; scene.add(l); PLUIE.tuiles.push(l); }
}
function placerPluie() {
  const P = PLUIE.pas, bx = Math.floor(player.pos.x / P), by = Math.floor(player.pos.y / P), bz = Math.floor(player.pos.z / P);
  let k = 0; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let e = 0; e <= 1; e++) PLUIE.tuiles[k++].position.set((bx + i) * P, (by + e - 0.5) * P - PLUIE.chute, (bz + j) * P);
}

// ---------- les passeurs ----------
const BARQUES = [], ANIME = {};
// qui tient la barque de chaque quai (STORY.md : Somsak, Mali, le passeur muet ; ailleurs, un
// batelier sans nom). Ils sont DANS la barque, et tanguent avec elle.
const BATELIERS = { panyi: ['pecheur', 0x6a7a5a], tapu: ['nok', 0x3a6aa0], suea: ['pecheur', 0x3a3a38], railay: ['pecheur', 0x8a5a3a], phiphi: ['pecheur', 0x4a5a7a] };
function barque(x, z, rot, pilote) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
  if (pilote) { const v = gensDeLeau(...pilote); if (v) { v.position.set(0, 0.45, 5.6); v.rotation.y = Math.PI; g.add(v); } }
  const bois = phMat('wood_planks', 1.5, 1.5, { color: 0x7a5a3a });
  const coque = new THREE.LatheGeometry([[0, 0], [0.75, 0.05], [0.95, 0.5], [1.0, 0.9]].map(([r, h]) => new THREE.Vector2(r, h)), 12);
  coque.scale(1, 1, 7.5); const c = mesh(coque, bois, 0, -0.3, 0); g.add(c);
  // la proue relevée, enrubannée comme le veut la coutume, et le long arbre du moteur
  const proue = mesh(new THREE.CylinderGeometry(0.08, 0.2, 2.6, 6), bois, 0, 1.1, -7.4); proue.rotation.x = -0.6; g.add(proue);
  g.add(mesh(new THREE.ConeGeometry(0.22, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0xc83a5a, roughness: 0.8 }), 0, 2.2, -8.1));
  const arbre = mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 5), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.6, roughness: 0.4 }), 0, 0.4, 8.4); arbre.rotation.x = 1.35; g.add(arbre);
  g.add(mesh(boxG(0.7, 0.6, 0.9), new THREE.MeshStandardMaterial({ color: 0x4a4a48, metalness: 0.5, roughness: 0.5 }), 0, 0.9, 6.4));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  BARQUES.push({ g, x, z, rot, ph: Math.random() * TAU });
  return BARQUES[BARQUES.length - 1];
}
function passeurs({ hauteur, addInteract }) {
  for (const [m, Q] of Object.entries(QUAIS)) {
    const B = barque(Q.barque[0], Q.barque[1], Math.atan2(Q.barque[0] - Q.ici[0], Q.barque[1] - Q.ici[1]), BATELIERS[m]);   // la proue vers le large
    B.quai = m; if (m === 'tapu' && !atteint3('masques')) B.g.visible = false;      // Mali ne navigue plus : sa barque est dans la cascade
    addInteract({ pos: new THREE.Vector3(Q.ici[0], hauteur(...Q.ici), Q.ici[1]), r: 9, prompt: () => 'parler au passeur',
      fn: () => {
        const vers = Object.entries(QUAIS).filter(([n]) => n !== m && trajetOuvert(m, n));
        let dit = vers.length ? PASSEUR[m] : (FERME[m] || 'Le passeur secoue la tête. Il ne va plus nulle part.');
        if (m === 'panyi' && atteint3('mali') && !atteint3('masques')) { dit = SOMSAK_MALI; noter3('mali'); }
        if (m === 'tapu' && !atteint3('masques') && vers.length) dit = 'Somsak attend dans sa barque, le moteur au ralenti. « Je te ramène quand tu veux. »';
        showMenu('LE PASSEUR', Q.nom, dit, [
          ...(m === 'suea' && !EN_INSTANCE && atteint3('masques') && !sait3('muet') && state.masqueBois ? [{ label: 'Montrer le masque de bois', fn: () => { hideMenu(); state.paused = false; noter3('muet');
            showMessage('Le passeur muet regarde le masque longtemps. Il hoche la tête, et te fait signe de monter.', 5); } }] : []),
          ...vers.map(([n, D]) => ({ label: 'Vers ' + D.nom + (prixTrajet(m, n) ? ` (${prixTrajet(m, n)} écus)` : ''), fn: () => { payerTrajet(m, n); traverser(D, hauteur, n); } })),
          { label: 'Rester ici', fn: () => { hideMenu(); state.paused = false; } }]);
      } });
  }
}
const SOMSAK_MALI = 'Somsak te regarde arriver. « Les moines… ils sont toujours là-haut ? Alors tout n’est pas perdu. Ma petite-fille, Mali, s’est arrêtée à Khao Phing Kan. Elle ne veut plus naviguer. Je t’y emmène. »';
// ce que dit un passeur qui ne va plus nulle part (STORY.md : ils ont perdu leur organisation)
const FERME = {
  tapu: 'Mali n’est pas dans sa barque. Elle est restée à terre, et regarde les pitons.',
  suea: 'Le passeur muet ne bouge pas. Il ne regarde personne. Il garde la main posée sur son moteur, comme s’il attendait quelque chose.',
  railay: 'Le passeur hausse les épaules. Sans les autres, il ne sait plus les passes.',
  phiphi: 'Le passeur hausse les épaules. Sans les autres, il ne sait plus les passes.',
};
// le premier voyage de Somsak se paie (SCENARIO.md § 12 : « des écus ») ; ensuite, il te connaît.
// Sans écus, il emmène quand même : l'histoire ne s'arrête pas faute d'argent.
const PRIX_SOMSAK = 5;
const prixTrajet = (a, b) => (!EN_INSTANCE && !state.somsakPaye && [a, b].includes('panyi') && [a, b].includes('phiphi') ? PRIX_SOMSAK : 0);
function payerTrajet(a, b) {
  const prix = prixTrajet(a, b);
  if (!prix) return;
  state.somsakPaye = true;
  if (BOURSE.peutPayer(prix)) { BOURSE.payer(prix); showMessage(`Tu donnes ${prix} écus à Somsak.`, 2.5); }
  else showMessage('« Garde tes sous. Rapporte-moi plutôt des nouvelles des moines. »', 4);
  saveGame(true);
}

// Les pêcheurs : une barque près de la grève, à portée de voix. Sur l'eau, ils vivent ; ils
// disent où l'on est et où aller (les îles, elles, ne répondent plus).
const PECHEURS = [
  { nom: 'Railay', barque: [-294, 1760], rive: [-302, 1763], dit: ['Railay. On n’y vient qu’en barque : les falaises ferment tout le reste.', 'Le sentier au sud du village monte jusqu’au câble des moines. Il redescend sur la plage de l’ouest, au ponton.'] },
  { nom: 'Ko Panyi', pres: [-30, 140], dit: ['Ko Panyi. Tout le village tient sur des pieux, au-dessus de l’eau.', 'Les maisons ne bougent plus. Nous, on pêche quand même : la mer, elle, n’a rien vu.', 'La porte de pierre est au pied du rocher, au nord. La petite Nok traîne par là.'] },
  { nom: 'Khao Phing Kan', pres: [-668, 545], dit: ['Le clou de pierre, là, dans l’eau ? C’est Ko Tapu.', 'Mali n’aime pas rester près des pitons. Elle dit qu’ils mangent le temps. Moi, je reste dans ma barque.'] },
  { nom: 'Ton Sai', barque: [2126, 1927], rive: [2130, 1919], dit: ['Ton Sai. Avant, ça criait partout : les bateaux, le marché. Maintenant, plus rien.', 'L’escalier des moines est derrière le village, sur la colline de l’est. En haut, un câble part vers le grand piton.'] },
];
function pecheurs({ hauteur, bloque, addInteract }) {
  for (const P of PECHEURS) {
    // sans place relevée : le premier bord praticable près de `pres` qui a de l'eau à 8 m
    if (!P.barque) trouve: for (let r = 0; r < 45; r += 1.5) for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU, x = P.pres[0] + Math.cos(a) * r, z = P.pres[1] + Math.sin(a) * r;
      if (bloque(x, z, 0.6) || hauteur(x, z) < 0.9) continue;
      for (let q = 0; q < 12; q++) { const b = q / 12 * TAU, bx = x + Math.cos(b) * 8, bz = z + Math.sin(b) * 8;
        if (hauteur(bx, bz) < -0.3 && hauteur(x + Math.cos(b) * 4, z + Math.sin(b) * 4) < 0.3) { P.rive = [x, z]; P.barque = [bx, bz]; break trouve; } }
    }
    if (!P.barque) continue;
    barque(P.barque[0], P.barque[1], Math.atan2(P.barque[0] - P.rive[0], P.barque[1] - P.rive[1]) + 1.2, ['pecheur', 0x6a5a48]);
    addInteract({ pos: new THREE.Vector3(P.rive[0], hauteur(...P.rive), P.rive[1]), r: 7, prompt: () => 'parler au pêcheur', fn: () => dialogue(P.dit.map((text) => ({ who: 'Le pêcheur', text }))) });
  }
}

// La traversée : un fondu au noir, et Camille est sur l'autre quai. Le passeur ne s'attarde pas.
function traverser(D, hauteur, vers) {
  hideMenu();
  fadeTo(1, () => {
    const [x, z] = D.ici; player.pos.set(x, hauteur(x, z), z);
    player.yaw = Math.atan2(D.ici[0] - D.barque[0], D.ici[1] - D.barque[1]); G.camYaw = player.yaw;
    placerPluie(); state.paused = false; fadeTo(0, null);
    showMessage('La barque file entre les pitons. ' + D.nom.charAt(0).toUpperCase() + D.nom.slice(1) + '.', 4);
    if (vers === 'phiphi') passer3('cloitre');      // débarqué à Ton Sai : la colline des moines
  });
}

// L'ARÈNE DE KO PANYI (multi, 5 octobre ; repliée ici de thailande-arene.js le 6 octobre) —
// cf. ARENE_LILLE dans game.js, docs/NOTE-MULTI.md. Le village sur pilotis : 7 000 m² de
// passerelles, de maisons et de barques autour du marché flottant (relevé du 5 octobre, en marchant
// aux règles du moteur depuis (70, 20) : de (−10, −40) à (120, 100), à 0,3–1,2 m sur l'eau). On s'y
// bat de passerelle en passerelle ; la mer ne se traverse pas. Puis on se resserre sur le marché.
// Pas de graphe déclaré : tloc-multi.js le tire tout seul (grapheAuto).
const ARENE_PANYI = {
  id: 'panyi', nom: 'Ko Panyi, le village sur pilotis',
  sd: (x, z) => Math.hypot(x - 60, z - 25), centre: [60, 25],
  depart: { x: 104, z: 10.4 },                  // le départ du lieu : face au marché flottant
  aires: [
    { id: 'village', nom: 'le village sur pilotis', r: 92,   // 92 : les départs des camps restent à 15 m de la limite
      couleur: '#ffd070', lueur: 0xffc860, eparpille: 45 },
    // le marché : ses barques bord à bord, que l'on traverse à pied (solMarche, thailande.js)
    { id: 'marche', nom: 'le marché flottant', r: 32, sd: (x, z) => Math.hypot(x - 96, z - 40), couleur: '#ff9a70', lueur: 0xff6a3a, eparpille: 20 },
  ],
  camps: {
    garnison: { nom: 'Les pêcheurs', court: 'Pêcheurs', pluriel: true },
    bourg: { nom: 'Les marchands', court: 'Marchands', pluriel: true },
  },
  campsTexte: 'Les pêcheurs du ponton contre les marchands du haut du village, de passerelle en passerelle.',
  // les deux bouts du village, à 120 m l'un de l'autre : le ponton de Somsak, le haut du village
  departsCamps: { garnison: [116, 8], bourg: [20, -28] },
  objets: [
    { id: 'armure-ponton', type: 'armure', x: 110, z: 12, nom: 'près du ponton' },
    { id: 'armure-village', type: 'armure', x: 18, z: -28, nom: 'en haut du village' },
    { id: 'arc-sud', type: 'arc', x: 54, z: 92, nom: 'au bout du village, côté sud' },
    { id: 'arc-ouest', type: 'arc', x: 10, z: -22, nom: 'sur les passerelles de l’ouest' },
    { id: 'bouclier', type: 'bouclier', x: 96, z: 40, nom: 'au marché flottant' },
  ],
  pointsForts: () => [
    { id: 'marche', nom: 'le marché flottant', x: 96, z: 40 },
    { id: 'ponton', nom: 'le ponton de Somsak', x: 118, z: 7.5 },
    { id: 'village', nom: 'le cœur du village', x: 60, z: 25 },
    { id: 'sud', nom: 'le bout du village', x: 54, z: 95 },
    { id: 'haut', nom: 'le haut du village', x: 14, z: -34 },
    { id: 'ouest', nom: 'les passerelles de l’ouest', x: 8, z: -28 },
  ],
};

monde({
  name: 'thailande', titre: 'La baie des pitons', musique: 'eau', h0: 0,
  plan: 'thailande.json', fin: 'relief-thailande.json',
  // la mousson arrêtée : un ciel bas et laiteux, une lumière sans ombre franche, la brume chaude.
  // La brume ne commence qu'à 700 m : à 260, la vue d'ensemble de la baie (îles à 1,5–2,5 km) n'était
  // plus qu'un voile blanc. Elle finit à 3 200 m, là où la caméra coupe (engine.js) : rien ne s'y
  // découpe net.
  ciel: [0x6a7884, 0xaab4b4, 0xd4d8cc], brume: [0xbcc6c0, 700, 3200], soleil: [-120, 260, 80, 2.2], soleilCouleur: 0xf4ecdc,
  sol: ['grass_ground', 0x8aa070], mer: 0, merCouleur: 0x2e7a78, merPoli: 0.12, merMetal: 0.55,
  murs: ['chaux_craquelee', 0xe4dccc], toit: { style: 'deuxPans', slug: 'clay_roof_tiles_02', couleur: 0xa84a2a, pente: 0.9, hMax: 4.5 }, hMurs: [3.2, 4.6],
  chemin: ['rocky_trail', 0xb8a888],
  socleMax: 2.5, socle: ['old_stone_wall_02', 0xb0a490],
  arbres: null,       // la jungle se plante ici (jungle()), sur le relief, pas sur les polygones de bois
  depart: { x: 104, z: 10.4, yaw: -0.27 },      // face au marché flottant, ses barques et ses marchandes (avant : le mur d'une maison sur pilotis)
  portes: [{ x: 61.5, z: -71.9, rot: 0.3, prompt: 'repasser la porte de l’île', vers: ['temple', [20.35, 0, -11.75], Math.atan2(-20.35, 11.75)], label: 'Retour à l’île du temps…' }],
  counts: 'La baie des pitons : Ko Panyi et son village sur pilotis, Khao Phing Kan, Railay, Phi Phi, et le grand piton du temple. Les passeurs attendent aux pontons.',
  start: 'La pluie ne tombe pas. Elle est là, en l’air, goutte par goutte. Seule la mer bouge encore.',
  entry: { title: 'La baie des pitons', sub: 'La Cloche des Îles — Thaïlande', cam: [700, 260, 900], at: [0, 20, 0], cam2: [180, 30, 80], at2: [40, 10, -40], dur: 6 },
  toitSur: toitThai, solLieu: (x, z) => solMarche(x, z) ?? solEscalier(x, z) ?? solCourse(x, z),      // la nage (le souffle du Yak) est dans monde.js, pour tous les mondes de mer
  // les endroits qui comptent, pour la minicarte et les lieux découverts (la forme commune à tous
  // les mondes, lue par monde.js) — type : 'lieu' | 'pnj' | 'quete' | 'passage'
  reperes: [
    { id: 'marche', nom: 'le marché flottant', x: 96, z: 40, r: 25, type: 'lieu' },
    { id: 'quai-panyi', nom: 'le ponton de Somsak', x: 118, z: 7.5, r: 15, type: 'passage' },
    { id: 'nok', nom: 'Nok, devant l’arche', x: 70, z: -62, r: 15, type: 'pnj' },
    { id: 'porte', nom: 'la porte de l’île', x: 61.5, z: -71.9, r: 10, type: 'passage' },
    { id: 'mosquee', nom: 'la mosquée de Ko Panyi', x: -117, z: -75, r: 25, type: 'lieu' },
    { id: 'quai-tapu', nom: 'Khao Phing Kan, le quai de Mali', x: -701, z: 551, r: 25, type: 'passage' },
    { id: 'ko-tapu', nom: 'Ko Tapu, le clou', x: -684, z: 468, r: 95, type: 'lieu' },        // il est dans l'eau : on le découvre depuis la grève, à 75–95 m
    { id: 'quai-suea', nom: 'le grand piton, la grève', x: 985, z: 491, r: 20, type: 'passage' },
    { id: 'chedi', nom: 'le chedi doré', x: 983, z: 344, r: 20, type: 'lieu' },
    { id: 'moines', nom: 'les moines de Ton Sai', x: 2603, z: 1775, r: 20, type: 'quete' },
    { id: 'cloitre', nom: 'le cloître', x: 2609, z: 1716, r: 18, type: 'quete' },
    { id: 'escalier-piton', nom: 'l’escalier du grand piton', x: 901, z: 290, r: 10, type: 'passage' },
    { id: 'cour-puits', nom: 'la cour du puits', x: 2604, z: 1745, r: 15, type: 'quete' },
    { id: 'quai-railay', nom: 'Railay, la plage de l’ouest', x: -657, z: 1530, r: 25, type: 'passage' },
    { id: 'cable-railay', nom: 'le câble de Railay', x: -587, z: 1920, r: 15, type: 'passage' },
    { id: 'railay', nom: 'le village de Railay', x: -500, z: 1700, r: 60, type: 'lieu' },
    { id: 'quai-tonsai', nom: 'Ton Sai, le ponton', x: 2187, z: 1927, r: 25, type: 'passage' },
    { id: 'tonsai', nom: 'le village de Ton Sai', x: 2350, z: 1820, r: 70, type: 'lieu' },
    { id: 'belvedere-moines', nom: 'le belvédère des moines', x: 2605, z: 1790, r: 15, type: 'passage' },
    // les pêcheurs dans leur barque, à portée de voix (pecheurs()) : ceux dont la place est relevée
    { id: 'pecheur-railay', nom: 'le pêcheur de Railay', x: -302, z: 1763, r: 12, type: 'pnj' },
    { id: 'pecheur-tonsai', nom: 'le pêcheur de Ton Sai', x: 2130, z: 1919, r: 12, type: 'pnj' },
  ],
  plus(ctx) {
    // la mousson : un ciel couvert éclaire de partout, le soleil ne fait qu'une ombre molle —
    // sans ça, les parois tournées au nord sont noires
    hemi.intensity = 1.25; hemi.color.setHex(0xe4ecf0); hemi.groundColor.setHex(0x5a6a50);
    // chaque morceau chronométré : le banc (bancs/lieu-thailande.mjs) les lit dans window.__lieu
    const durees = {}, chrono = (nom, fn) => { const t = performance.now(); fn(ctx); durees[nom] = Math.round(performance.now() - t); };
    for (const [nom, fn] of [['parois', parois], ['voies', voies], ['escalier', escalier], ['esplanade', esplanade], ['cloître', cloitre], ['khao phing kan', khaoPhingKan], ['grotte', grotte], ['yak', yak], ['jungle', jungle], ['pilotis', pilotis], ['temples', templesThai], ['ko tapu', koTapu], ['chedi', chedi],
      ['passeurs', passeurs], ['pluie', pluie], ['habitants', habitants], ['marché', marche], ['pêcheurs', pecheurs], ['tyroliennes', tyroliennes], ['bâti', batiIles], ['garde', garde]]) chrono(nom, fn);
    placerPluie();
    // les quais et les câbles : le parcours du banc (TLOC_PARCOURS=1) s'en sert pour passer d'une île à l'autre
    window.__lieu = { durees, quais: Object.values(QUAIS).map((Q) => Q.ici), cables: CABLES.filter((c) => c.p0).map((c) => [c.de, c.a]) };
  },
  anime(now) {
    const t = now / 1000, dt = Math.min(0.1, (now - (ANIME.t || now)) / 1000); ANIME.t = now;
    // l'acte se pose à la première image de jeu, APRÈS le chargement de la sauvegarde : le faire
    // dès que le monde est bâti sauvegardait un acte neuf par-dessus la partie qu'on rechargeait
    if (!A3.pret && !EN_INSTANCE && state.running) {
      A3.pret = true;
      if (!state.acte3) { state.acte3 = 'gong'; saveGame(true); }
      if (atteint3('fete') && state.clocheIles) poserFin();
    }
    animeHabitants(dt);
    for (const v of VENDEURS) PNJ.animeVillageois(v, dt, false);
    animeGlisse(dt); animeKpk(dt); animeCourse(dt); animeGrotte(dt); animeVent(dt); animeYak(dt); animeFin(dt); animeFete(dt);
    if (MARCHE.coques) MARCHE.coques.position.y = Math.sin(t * 1.1) * 0.04;
    if (gongActif() || tempsRendu()) placerPluie();
    for (const b of BARQUES) { b.g.position.y = Math.sin(t * 1.3 + b.ph) * 0.12; b.g.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.03; }
    if (PLUIE.tuiles.length && (t * 4 | 0) % 2 === 0) placerPluie();
    // vue de loin (le plan d'arrivée), la pluie ne serait qu'un pavé blanc posé sur la baie
    const proche = camera.position.distanceTo(player.pos) < 90 && !GROTTE.dedans; for (const l of PLUIE.tuiles) l.visible = proche;     // ni de loin, ni sous la roche
  },
}).then(() => {
  if (!(G.level && G.level.name === 'thailande')) return;
  G.level.arenes = [ARENE_PANYI];
  if (EN_INSTANCE) return;
  G.level.indices = indices3;
  // pour les bancs (bancs/acte3-*.mjs) : les quais, les trajets ouverts
  window.__acte3 = { A3, QUAIS, trajetOuvert, atteint3, CLOITRE, FIGES, KPK, COURSE, GROTTE, VENT, YAK, CABLES, FETE };
});
