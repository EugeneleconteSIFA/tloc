// Les Pouilles — alberobello (pouilles.js : la fiche et l'habillage ; monde.js : la recette)
// =====================================================================
// Ce qui n'est qu'à Alberobello : Cosimo, l'apprenti mécanicien du petit train, sur le quai de
// la gare — il vit au bout de la ligne, dans un trullo près de la gare (docs/DECISIONS-RECIT.md,
// § 1). Jeune à l'arrivée de Camille (acte IV, étape `arrivee`) ; ensuite, un autre apprenti tient
// le quai : Cosimo a vieilli, comme tout le monde.
// =====================================================================
import { ville, GARES, etape4, passe4, naitre4 } from './pouilles.js';
import { THREE, dialogue, G, state, saveGame } from './engine.js?v=41';
import * as PNJ from './pnj.js';

let cosimo = null, apprenti = null, quai = null, tAvant = 0;

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

ville('alberobello', {
  plus({ hauteur, addInteract, scene }) {
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
  },
});
