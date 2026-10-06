// Les Pouilles — alberobello (pouilles.js : la fiche et l'habillage ; monde.js : la recette)
// =====================================================================
// Ce qui n'est qu'à Alberobello : Cosimo, l'apprenti mécanicien du petit train, sur le quai de
// la gare — il vit au bout de la ligne, dans un trullo près de la gare (docs/DECISIONS-RECIT.md,
// § 1). Jeune à l'arrivée de Camille (acte IV, étape `arrivee`) ; ensuite, un autre apprenti tient
// le quai : Cosimo a vieilli, comme tout le monde.
// Et Assunta, la joueuse de tambourin, la fille de Nunzia, devant son trullo près de la gare
// (étapes 7 et 8) : la corde volée par les tarentules, puis le tambourin.
// =====================================================================
import { ville, GARES, etape4, passe4, passer4, indice4, naitre4, donnerTambourin, EN_INSTANCE } from './pouilles.js';
import { THREE, TAU, dialogue, G, state, saveGame, phMat } from './engine.js?v=41';
import * as PNJ from './pnj.js';

let cosimo = null, apprenti = null, quai = null, tAvant = 0, joueuse = null, ctxA = null, placeJ = null;

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
  if (passe4('tambourin')) return dialogue([{ who: 'Assunta', text: '**Les portes du château de Matera.** Trois coups, un silence.' }]);
  dialogue([{ who: 'Assunta', text: 'Pas maintenant. Tout le monde court, ici.' }]);
}
// devant un trullo, près de la gare : la première place libre au pied d'un mur, vers la ville
function placeJoueuse({ hauteur, bloque }) {
  const g = GARES.alberobello, x0 = g.x + 25, z0 = g.z;
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
  },
});
