// L'ARÈNE DE KO PANYI (multi, 5 octobre) — cf. ARENE_LILLE dans game.js, docs/NOTE-MULTI.md.
//
// Elle appartient à thailande.js (« chaque lieu déclare son arène dans son propre fichier ») ;
// elle est ici pour l'instant parce qu'une autre session tenait thailande.js le 5 octobre (l'escalier
// du grand piton, non publié) : publier ce fichier-là aurait emporté son travail. À REPLIER dans
// thailande.js (`arenes` sur le niveau, comme garde-guerin.js) dès que cette session a publié.
// thailande.html ne charge ce module qu'en instance, avec tloc-multi.js.
//
// Le village sur pilotis de Ko Panyi : 7 000 m² de passerelles, de maisons et de barques autour du
// marché flottant (relevé du 5 octobre, en marchant aux règles du moteur depuis (70, 20) : de
// (−10, −40) à (120, 100), à 0,3–1,2 m sur l'eau). On s'y bat de passerelle en passerelle ; la mer,
// elle, ne se traverse pas (monde.js la bloque). Puis on se resserre sur le marché flottant.
import { G } from './engine.js?v=41';

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
// le niveau naît dans monde() (après l'installation de Camille) : on l'attend
const poser = () => { if (G.level && G.level.name === 'thailande') { G.level.arenes = [ARENE_PANYI]; return; } setTimeout(poser, 200); };
poser();
