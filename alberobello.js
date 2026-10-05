// Les Pouilles — alberobello (pouilles.js : la fiche et l'habillage ; monde.js : la recette)
// =====================================================================
// Ce qui n'est qu'à Alberobello : Cosimo, l'apprenti mécanicien du petit train, sur le quai de
// la gare — il vit au bout de la ligne, dans un trullo près de la gare (docs/DECISIONS-RECIT.md,
// § 1). La quête de la lettre n'est pas encore écrite : il ne dit que ce qu'il sait déjà.
// =====================================================================
import { ville, GARES } from './pouilles.js';
import { THREE, dialogue, G } from './engine.js?v=41';
import * as PNJ from './pnj.js';

let cosimo = null, tAvant = 0;

function parlerCosimo() {
  dialogue([
    { who: 'Cosimo', text: 'Le train repart dans une minute. Ici, une minute, ce n’est rien.' },
    { who: 'Cosimo', text: 'Je descends jusqu’à Gallipoli, et je remonte. Tous les jours.' },
    { who: 'Cosimo', text: 'À Gallipoli, il y a une fille, sur le quai… Non. Rien.' },
  ]);
}

ville('alberobello', {
  plus({ hauteur, addInteract, scene }) {
    // au bord du quai, côté voies, un peu à l'écart du bâtiment : au milieu du quai, on ne
    // l'atteignait pas (le quai est un obstacle, on lui parle d'en bas)
    const g = GARES.alberobello, c = Math.cos(g.rot), s = Math.sin(g.rot), a = 7, b = -2.6;
    const x = g.x + a * c - b * s, z = g.z + a * s + b * c, y = g.y + 0.9;
    cosimo = PNJ.buildRole('cosimo'); if (!cosimo) return;
    cosimo.scale.setScalar(G.echelle); cosimo.position.set(x, y, z); cosimo.rotation.y = -g.rot + Math.PI / 2; scene.add(cosimo);
    addInteract({ pos: new THREE.Vector3(x, y, z), r: 3.5, prompt: () => 'parler à Cosimo', fn: parlerCosimo });
  },
  anime(now) {
    const dt = Math.min(0.1, (now - (tAvant || now)) / 1000); tAvant = now;
    if (cosimo && cosimo.userData.ctrl) PNJ.animeVillageois(cosimo, dt, false);
  },
});
