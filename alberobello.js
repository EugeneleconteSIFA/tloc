// Les Pouilles — alberobello (pouilles.js : la fiche et l'habillage ; monde.js : la recette)
// =====================================================================
// Ce qui n'est qu'à Alberobello : Cosimo, l'apprenti mécanicien du petit train, sur le quai de
// la gare — il vit au bout de la ligne, dans un trullo près de la gare (docs/DECISIONS-RECIT.md,
// § 1). Jeune à l'arrivée de Camille (acte IV, étape `arrivee`) ; ensuite, un autre apprenti tient
// le quai : Cosimo a vieilli, comme tout le monde.
// Et Assunta, la joueuse de tambourin, la fille de Nunzia, devant son trullo près de la gare
// (étapes 7 et 8) : la corde volée par les tarentules, puis le tambourin.
// =====================================================================
import { ville, GARES, CONES, etape4, passe4, passer4, indice4, naitre4, donnerTambourin, EN_INSTANCE, TEMPS, ECOUTE4 } from './pouilles.js';
import * as BOURSE from './bourse.js';
import * as LOOK from './look.js';
import { especeGeo } from './foret.js';
import { THREE, TAU, dialogue, G, state, saveGame, phMat, setQuest, questStep, scene, mesh, addInteract, showMessage, player, SFX } from './engine.js?v=41';
import * as PNJ from './pnj.js';

let cosimo = null, apprenti = null, quai = null, tAvant = 0, joueuse = null, ctxA = null, placeJ = null, vieux = null, placeV = null;

function parlerCosimo() {
  dialogue([
    { who: 'Cosimo', text: 'Le train repart dans une minute. Ici, une minute, ce n’est rien.' },
    { who: 'Cosimo', text: 'Je descends jusqu’à **Gallipoli**, et je remonte. Tous les jours. **Le géant de bronze du port s’est mis à marcher**, là-bas.' },
    { who: 'Cosimo', text: 'À Gallipoli, il y a une fille, sur le quai… Non. Rien.' },
  ]);
}

function parlerApprenti() {
  dialogue([{ who: 'L’apprenti', text: 'Cosimo ? Il ne descend plus. Il a vieilli, comme tout le monde.' }]);
}

function parlerJoueuse() {
  const e = etape4();
  if (e === 'soixante') return dialogue([
    { who: 'Assunta', text: 'Ma mère t’envoie ? Elle parle encore de toi. Une fille qui ne vieillit pas.' },
    { who: 'Assunta', text: 'Mon tambourin n’a plus de corde. **Les tarentules** l’ont emportée. Elles montent **des grottes sous les remparts de Gallipoli**. On n’y entre qu’**à marée basse**.',
      fn: () => { passer4('corde'); indice4('tarentules'); } },
  ]);
  if (e === 'corde' && state.corde4) return dialogue([
    { who: 'Assunta', text: 'Tu l’as ! Attends…' },
    { text: 'Elle retend la peau, noue la corde, et frappe trois coups. Un silence.' },
    { who: 'Assunta', text: 'Écoute : trois coups, un silence. **La pizzica.** Bats-la, et **le temps ralentit autour de toi** (K).', fn: donnerTambourin },
    { who: 'Assunta', text: '**Les portes du château de Matera** attendent ce rythme-là depuis longtemps.' },
  ]);
  if (e === 'corde') return dialogue([{ who: 'Assunta', text: 'La corde est **dans les grottes sous les remparts de Gallipoli**. **À marée basse**, Camille.' }]);
  if (passe4('tambourin') && questStep('pizzica4') >= 3) return dialogue([{ who: 'Assunta', text: 'Tu danses mieux que ma mère. Ne le lui dis pas.' }]);
  if (passe4('tambourin')) return dialogue([
    { who: 'Assunta', text: 'Ce soir, c’est la pizzica, devant chez moi. **Danse avec moi** : quatre mesures, trois coups, un silence, et toi **dans le silence** (K).', fn: () => { if (!questStep('pizzica4')) setQuest('pizzica4', 1); FETE.actif = true; FETE.reussies = 0; FETE.t0 = -1; showMessage('La pizzica : bats le tambourin (K) pour lancer une mesure, puis frappe dans le silence.', 5); } },
  ]);
  dialogue([{ who: 'Assunta', text: 'Pas maintenant. Tout le monde court, ici.' }]);
}
// Cosimo vieux, devant son trullo près de la gare (la lettre, DECISIONS-RECIT.md § 1). L'encre de la
// lettre pâlit en un instant ici : on la lui tend dans le ralenti du tambourin, ou elle ne se lit plus.
function parlerVieuxCosimo() {
  if (state.lettre4 === 'lettre' && TEMPS.lent >= 1) return dialogue([
    { text: 'Tu sors la lettre de Nunzia. Sous tes yeux, l’encre pâlit, les mots s’effacent.' },
    { who: 'Cosimo', text: 'Une lettre ? … Il n’y a rien d’écrit, petite. **Le temps l’a bue.** Il faudrait le retenir un peu.' },
  ]);
  if (state.lettre4 === 'lettre') return dialogue([
    { who: 'Cosimo', text: 'Une lettre ? De Gallipoli ? … Elle a mis des années à venir.' },
    { text: 'Il la lit, lentement. Il la relit.' },
    { who: 'Cosimo', text: 'Attends. Prends ça. **Toutes les lettres que je ne lui ai jamais envoyées.** Porte-les-lui.',
      fn: () => { state.lettre4 = 'boite'; setQuest('lettre', 2); saveGame(true); } },
  ]);
  if (state.lettre4 === 'boite') return dialogue([{ who: 'Cosimo', text: 'Elle est toujours sur le quai ? Alors **à Gallipoli**. Vite.' }]);
  if (state.lettre4 === 'rendue') return dialogue([{ who: 'Cosimo', text: 'Une minute par jour. On aurait dû descendre du train.' }]);
  dialogue([{ who: 'Cosimo', text: 'Je réparais les machines du petit train. Maintenant, je les écoute passer.' }]);
}

// =====================================================================
//  Les petites quêtes d'Alberobello (SCENARIO.md § 13)
// =====================================================================
// La fête de la pizzica : la mesure des portes du château (trois coups, un silence), quatre fois.
const FETE = { actif: false, reussies: 0, t0: -1, sonne: -1 };
ECOUTE4.push(() => {
  if (!FETE.actif || !joueuse || Math.hypot(player.pos.x - joueuse.position.x, player.pos.z - joueuse.position.z) > 8) return;
  const t = state.time - FETE.t0;
  if (FETE.t0 > 0 && t > 0.3 && t < 4) {
    FETE.t0 = -1;
    if (t >= 2.1 && t <= 3.0) { FETE.reussies++; SFX.chirp();
      if (FETE.reussies >= 4) { FETE.actif = false; setQuest('pizzica4', 2, true); finFete(); }
      else showMessage(`Une mesure ! (${FETE.reussies} / 4)`, 1.8); }
    else showMessage('Raté. Trois coups, un silence, et toi dans le silence.', 2.2);
    return;
  }
  FETE.t0 = state.time;
});
function feteTick() {
  if (!FETE.actif || FETE.t0 < 0) return;
  const t = state.time - FETE.t0, k = [0.6, 1.2, 1.8].findIndex((b) => t > b && t < b + 0.15);
  if (k >= 0 && FETE.sonne !== k) { FETE.sonne = k; SFX.piece(); } else if (k < 0) FETE.sonne = -1;
  if (t > 4) FETE.t0 = -1;
}
function finFete() {
  // la tenue de la fête : des couleurs que l'armoire connaît déjà (une couleur neuve n'existerait
  // que dans les Pouilles, et la sauvegarde la relirait à Lille hors de la palette)
  dialogue([
    { who: 'Assunta', text: 'Tu tiens le rythme comme une fille d’ici.' },
    { text: 'Elle te passe une tunique rouge et te noue un foulard safran : la tenue de la fête.',
      fn: () => { const L = LOOK.look(); L.tunique = 1; L.foulard = 2; LOOK.appliquer(); state.tenue4 = true; setQuest('pizzica4', 3); saveGame(true); } },
  ]);
}

// La récolte : une oliveraie au bord du cœur, trois oliviers, six grappes. Une grappe mûrit et
// pourrit en douze secondes ; elle n'est bonne à cueillir qu'une seconde et demie (huit fois plus
// au tambourin). Chaque grappe a son retard : on court de l'une à l'autre.
const OLIVES = { grappes: [], fermier: null, place: null, n: 0 };
const etatGrappe = (g) => { const c = (OLIVES.t + g.decal) % 12; return c < 8 ? 'verte' : c < 9.5 ? 'mure' : 'pourrie'; };
const COUL = { verte: new THREE.Color(0x6a7a3a), mure: new THREE.Color(0x3a1e3a), pourrie: new THREE.Color(0x4a3a24) };
function oliveraie() {
  const [x0, y0, z0, yaw] = OLIVES.place, esp = especeGeo('chene');
  for (let k = 0; k < 3; k++) {
    const a = yaw + (k - 1) * 0.9, x = x0 + Math.sin(a) * 5, z = z0 + Math.cos(a) * 5, y = ctxA.hauteur(x, z);
    // l'olivier : l'arbre de la ville (son tronc, sa couronne, leurs matières), bas et large — un
    // tronc et une couronne refaits à part sortaient noirs, la couronne en dalle (6 octobre)
    if (esp) for (const [geo, m] of [[esp.tronc, esp.matT], [esp.houppier, esp.matH]]) { const o = new THREE.Mesh(geo, m); o.scale.set(3.4, 2.4, 3.4); o.position.set(x, y - 0.2, z); o.castShadow = true; scene.add(o); }
    for (const c of [-1, 1]) {
      const gx = x + Math.cos(a) * c * 1.6, gz = z - Math.sin(a) * c * 1.6, grappe = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: 0x6a7a3a, roughness: 0.5 });
      for (let i = 0; i < 7; i++) grappe.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), m, Math.sin(i * 2.4) * 0.07, -i * 0.03, Math.cos(i * 2.4) * 0.07));
      grappe.position.set(gx, y + 1.7, gz); scene.add(grappe);
      const g = { grappe, m, decal: (k * 2 + (c + 1) / 2) * 1.9, prise: false };
      OLIVES.grappes.push(g);
      addInteract({ pos: new THREE.Vector3(gx, y, gz), r: 2.2, prompt: () => 'cueillir les olives', enabled: () => !g.prise && questStep('recolte4') === 1,
        fn: () => { const e = etatGrappe(g);
          if (e === 'verte') return showMessage('Encore vertes.', 1.5);
          if (e === 'pourrie') return showMessage('Pourries, déjà. Ici, une olive ne reste pas mûre longtemps.', 2.5);
          g.prise = true; g.grappe.visible = false; OLIVES.n++; SFX.pickup();
          if (OLIVES.n >= 6) { setQuest('recolte4', 2); } else showMessage(`Une grappe mûre ! (${OLIVES.n} / 6)`, 1.8); } });
    }
  }
}
function parlerFermier() {
  const s = questStep('recolte4');
  if (!s) return dialogue([
    { who: 'Le fermier', text: 'Mes olives mûrissent le matin et pourrissent à midi. Je n’ai plus les jambes pour courir après.' },
    { who: 'Le fermier', text: 'Cueille-m’en **six grappes mûres** : les noires, pas les vertes, pas les brunes.', fn: () => { setQuest('recolte4', 1); OLIVES.n = 0; for (const g of OLIVES.grappes) { g.prise = false; g.grappe.visible = true; } } },
  ]);
  if (s === 1) return dialogue([{ who: 'Le fermier', text: `${OLIVES.n} sur six. Les noires, petite. Vite.` }]);
  if (s === 2) return dialogue([
    { who: 'Le fermier', text: 'Six ! De quoi presser une fiole. Tiens : **l’huile des Pouilles**. Elle soigne tout.',
      fn: () => { if (!BOURSE.remplir('huile')) { player.hp = player.maxHp; showMessage('Tu n’as pas de gourde libre : il t’en frotte les mains. Toute ta vie revient.', 4); }
        else showMessage('Une fiole d’huile dans ta gourde (B : boire).', 3.5); setQuest('recolte4', 3); saveGame(true); } },
  ]);
  dialogue([{ who: 'Le fermier', text: 'Mille ans, ces arbres. Ils en ont vu passer, des journées trop courtes.' }]);
}
function oliveraieTick(dt) {
  OLIVES.t = (OLIVES.t || 0) + dt * TEMPS.lent;
  for (const g of OLIVES.grappes) g.m.color.copy(COUL[etatGrappe(g)]);
}

// Les signes des trulli : douze symboles blancs peints à la chaux sur les cônes, comme les vrais
// (le soleil, la lune, la croix, le cœur…). On les lit depuis la rue. Le dernier montre le Temple.
const SIGNES = [
  ['☀', 'le soleil'], ['☾', 'la lune'], ['✝', 'la croix'], ['♥', 'le cœur percé'], ['✦', 'l’étoile'], ['◯', 'le cercle du monde'],
  ['△', 'la montagne'], ['⚘', 'l’arbre de vie'], ['♆', 'le trident'], ['☽', 'le croissant'], ['⊕', 'la terre'], ['♜', 'une tour, et des cloches pendues dedans : le Temple']];
const LUS = () => (state.signes4 = state.signes4 || {});
function signesTrulli() {
  const { hauteur, bloque } = ctxA, d = window.__pouilles ? window.__pouilles.cones : CONES;
  // douze cônes répartis dans le cœur, chacun avec une place libre dans la rue au pied du trullo
  const pris = [], c = [...d].filter((q) => q[3] !== undefined).sort((a, b) => (a[0] * 0.7 + a[1]) - (b[0] * 0.7 + b[1]));
  for (let i = 0; i < c.length && pris.length < 12; i += Math.max(1, Math.floor(c.length / 14))) {
    const [cx, cz, r, haut] = c[i]; let place = null;
    for (let k = 0; k < 16 && !place; k++) { const a = k / 16 * TAU, x = cx + Math.cos(a) * (r + 2.2), z = cz + Math.sin(a) * (r + 2.2); if (!bloque(x, z, 0.7)) place = [x, z, a]; }
    if (!place || pris.some((p) => Math.hypot(p.cx - cx, p.cz - cz) < 25)) continue;
    pris.push({ cx, cz, r, haut, place });
  }
  pris.forEach((p, k) => {
    const [sym, nom] = SIGNES[k], cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.font = 'bold 96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sym, 64, 70);
    const tex = new THREE.CanvasTexture(cv);
    // la chaux posée SUR la pierre du cône : le grain de la pierre reste visible sous le blanc
    const plan = new THREE.Mesh(new THREE.PlaneGeometry(p.r * 0.7, p.r * 0.7), new THREE.MeshStandardMaterial({ color: 0xf4f0e8, alphaMap: tex, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    // à 32 % de sa hauteur, le cône fait encore 74 % de son rayon (coneTrullo, pouilles.js) : le
    // signe se pose juste devant, sinon la pierre le cache
    const a = p.place[2], rr = p.r * 0.79, hy = p.haut + p.r * 1.55 * 0.32;
    plan.position.set(p.cx + Math.cos(a) * rr, hy, p.cz + Math.sin(a) * rr); plan.lookAt(p.cx + Math.cos(a) * 10, hy + 3.2, p.cz + Math.sin(a) * 10); scene.add(plan);
    const [x, z] = p.place;
    addInteract({ pos: new THREE.Vector3(x, hauteur(x, z), z), r: 3, prompt: () => 'lire le signe du trullo', enabled: () => !LUS()[k],
      fn: () => { LUS()[k] = true; if (!questStep('signes4')) setQuest('signes4', 1, true);
        const n = Object.keys(LUS()).length; SFX.pickup();
        if (n >= 12) { setQuest('signes4', 3); player.maxHp += 2; player.hp = player.maxHp; showMessage(`Le douzième signe : ${nom}. Un réceptacle de cœur !`, 5); }
        else showMessage(`Un signe peint sur le cône : ${nom}. (${n} / 12)`, 3); saveGame(true); } });
  });
  OLIVES.signes = pris;
}

// devant un trullo, près de la gare : la première place libre au pied d'un mur, vers la ville
function placeJoueuse({ hauteur, bloque }, x0 = GARES.alberobello.x + 25, z0 = GARES.alberobello.z) {
  for (let r = 4; r < 50; r += 2) for (let k = 0; k < 24; k++) {
    const a = k / 24 * TAU, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
    if (bloque(x, z, 1.2)) continue;
    for (let j = 0; j < 8; j++) { const b = j / 8 * TAU;
      if (bloque(x + Math.cos(b) * 1.6, z + Math.sin(b) * 1.6, 0.2) && !bloque(x - Math.cos(b) * 3, z - Math.sin(b) * 3, 0.6))
        return [x, hauteur(x, z), z, Math.atan2(-Math.cos(b), -Math.sin(b))]; }
  }
  return [x0, hauteur(x0, z0), z0, 0];
}
// le tambourin dans sa main : un cercle de bois clair, la peau tendue, des grelots
function tambourin() {
  const t = new THREE.Group(), bois = phMat('wood_planks', 0.5, 0.2, { color: 0xc8a070 });
  const cercle = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 24, 1, true), bois); cercle.material.side = THREE.DoubleSide;
  const peau = new THREE.Mesh(new THREE.CircleGeometry(0.165, 24), new THREE.MeshStandardMaterial({ color: 0xead8b0, roughness: 0.8 })); peau.rotation.x = -Math.PI / 2; peau.position.y = 0.03;
  t.add(cercle, peau); t.rotation.x = Math.PI / 2; return t;
}

window.__alberobello = { OLIVES, FETE, etatGrappe };      // pour les bancs (bancs/acte4-*.mjs)

ville('alberobello', {
  plus(ctx) { ctxA = ctx; const { hauteur, addInteract, scene } = ctx;
    // au bord du quai, côté voies, un peu à l'écart du bâtiment : au milieu du quai, on ne
    // l'atteignait pas (le quai est un obstacle, on lui parle d'en bas)
    const g = GARES.alberobello, c = Math.cos(g.rot), s = Math.sin(g.rot), a = 7, b = -2.6;
    const x = g.x + a * c - b * s, z = g.z + a * s + b * c, y = g.y + 0.9;
    quai = [x, y, z, -g.rot + Math.PI / 2];
    cosimo = PNJ.buildRole('cosimo'); if (!cosimo) return;
    cosimo.scale.setScalar(G.echelle); cosimo.position.set(x, y, z); cosimo.rotation.y = -g.rot + Math.PI / 2; scene.add(cosimo);
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 3.5, prompt: () => 'parler à Cosimo', fn: parlerCosimo, enabled: () => cosimo.visible });
  },
  anime(now) {
    const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
    if (cosimo && cosimo.userData.ctrl) PNJ.animeVillageois(cosimo, dt, false);
    if (!state.running) return;
    // la première fois, en sortant du trullo de la porte : le soleil bouge à vue d'œil
    if (etape4() === 'arrivee' && !(state.ind4 && state.ind4.soleil)) {
      state.ind4 = state.ind4 || {}; state.ind4.soleil = true; saveGame(true);
      dialogue([{ who: 'Camille', text: 'Le soleil… il court.' }]);
    }
    // après l'arrivée, Cosimo ne tient plus le quai : un autre apprenti, né après le chargement
    if (cosimo && quai && passe4('quinze')) { cosimo.visible = false;
      if (!apprenti) apprenti = naitre4('apprenti', ...quai, 'parler à l’apprenti', parlerApprenti); }
    if (apprenti && apprenti.userData.ctrl) PNJ.animeVillageois(apprenti, dt, false);
    // Assunta, née après le chargement (sa place se cherche aussi après : rien au chargement)
    if (!EN_INSTANCE && ctxA && joueuse === null) {
      if (!placeJ) placeJ = placeJoueuse(ctxA);
      else { joueuse = naitre4('joueuse', ...placeJ, 'parler à la joueuse de tambourin', parlerJoueuse);
        if (joueuse && joueuse.userData.perso) PNJ.socket(joueuse, joueuse.userData.perso, 'hand_l', tambourin(), [0, 0.05, 0.08]); }
    }
    if (joueuse && joueuse.userData.ctrl) PNJ.animeVillageois(joueuse, dt, false);
    // Cosimo vieux : dès que Nunzia a confié la lettre (il a vieilli avec elle)
    if (!EN_INSTANCE && ctxA && joueuse && vieux === null && state.lettre4) {
      if (!placeV) placeV = placeJoueuse(ctxA, GARES.alberobello.x + 30, GARES.alberobello.z + 22);
      else vieux = naitre4('cosimo_vieux', ...placeV, 'parler au vieux Cosimo', parlerVieuxCosimo);
    }
    if (vieux && vieux.userData.ctrl) PNJ.animeVillageois(vieux, dt, false);
    // les petites quêtes, nées après le chargement, une chose par image
    if (!EN_INSTANCE && ctxA && joueuse) {
      if (!OLIVES.place) OLIVES.place = placeJoueuse(ctxA, GARES.alberobello.x - 10, GARES.alberobello.z + 40);
      else if (!OLIVES.grappes.length) oliveraie();
      else if (!OLIVES.fermier) OLIVES.fermier = naitre4('fermier', ...OLIVES.place, 'parler au fermier', parlerFermier);
      else if (!OLIVES.signes) signesTrulli();
      oliveraieTick(dt); feteTick();
    }
    if (OLIVES.fermier && OLIVES.fermier.userData.ctrl) PNJ.animeVillageois(OLIVES.fermier, dt, false);
  },
});
