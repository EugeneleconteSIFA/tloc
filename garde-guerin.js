// La Lozère — la Garde-Guérin (lozere.js : la fiche ; monde.js : la recette)
import { lieu } from './lozere.js';
import { G } from './engine.js?v=41';
const pret = lieu('gardeguerin');
import * as PNJ_E from './engine.js?v=41';
import * as PNJ from './pnj.js';

// L'ARÈNE du multi (5 octobre, cf. ARENE_LILLE dans game.js et docs/NOTE-MULTI.md) : le
// village-forteresse tient dans son enceinte (175 × 165 m, relevée par OSM : PLAN.garde), et
// c'est déjà un terrain de bataille — la tour carrée, le château en ruine, l'église, les
// ruelles entre les maisons de granit. On s'y bat dans le village, puis dans son cœur.
// Le péage de la Régordane fait les deux camps : la garde de la tour contre les muletiers.
const C = [1816, -5329];                 // le milieu de l'enceinte, à deux pas de la place
const ARENE_GARDE = {
  id: 'gardeguerin', nom: 'La Garde-Guérin',
  sd: (x, z) => Math.hypot(x - C[0], z - C[1]), centre: C,
  depart: { x: 1815, z: -5340 },         // la place du village (OSM : « La Garde-Guérin »)
  aires: [
    // 95 m : l'enceinte entière et le belvédère sur les gorges (84 m du centre)
    { id: 'village', nom: 'le village fortifié', r: 95, couleur: '#ffd070', lueur: 0xffc860, eparpille: 60 },
    // 42 m : la place, l'église Saint-Michel (38 m), le four banal (26 m)
    { id: 'coeur', nom: 'le cœur du village', r: 42, couleur: '#ff9a70', lueur: 0xff6a3a, eparpille: 30 },
  ],
  camps: {
    garnison: { nom: 'La garde de la tour', court: 'Garde', pluriel: false },
    bourg: { nom: 'Les muletiers de la Régordane', court: 'Muletiers', pluriel: true },
  },
  bannieres: true,               // une bannière à chaque ralliement (tloc-multi.js) ; ni forge ni fête ici
  campsTexte: 'La garde de la tour contre les muletiers de la Régordane, qui ne veulent plus payer le péage.',
  // chacun part de chez lui : la garde au pied de sa tour, les muletiers à l'auberge
  departsCamps: { garnison: [1822, -5366], bourg: [1766, -5336] },
  objets: [
    { id: 'armure-tour', type: 'armure', x: 1818, z: -5360, nom: 'au pied de la tour' },
    { id: 'armure-auberge', type: 'armure', x: 1770, z: -5330, nom: 'devant l’auberge' },
    { id: 'arc-eglise', type: 'arc', x: 1846, z: -5328, nom: 'sur le parvis de Saint-Michel' },
    { id: 'arc-four', type: 'arc', x: 1794, z: -5322, nom: 'au four banal' },
    { id: 'bouclier', type: 'bouclier', x: 1815, z: -5340, nom: 'sur la place du village' },
  ],
  pointsForts: () => [
    { id: 'place', nom: 'la place du village', x: 1815, z: -5340 },
    { id: 'tour', nom: 'le pied de la tour', x: 1822, z: -5366 },
    { id: 'eglise', nom: 'le parvis de Saint-Michel', x: 1848, z: -5332 },
    { id: 'four', nom: 'le four banal', x: 1792, z: -5325 },
    { id: 'auberge', nom: 'l’auberge de la Régordane', x: 1766, z: -5336 },
    { id: 'belvedere', nom: 'le belvédère des gorges', x: 1870, z: -5388 },
  ],
};
// le niveau existe dès que monde() a installé Camille (son bootLevel le range dans G.level)
pret.then(() => { if (G.level && G.level.name === 'gardeguerin') G.level.arenes = [ARENE_GARDE]; });
